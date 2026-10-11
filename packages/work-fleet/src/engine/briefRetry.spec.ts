import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { answerReport } from "#test/report.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("retry of receiptless preparation prepares the current approved revision without another human decision", () =>
	withFleetBoard({}, (_fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const files = boardHttpFiles(root);
			files.write("one.md", source.replace("fleet: approved", "fleet: draft"));
			const decision = (yield* fleet.dispatch("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing decision");
			}
			const current = `${source}\nNew approved criteria.\n`;
			files.write("one.md", current);
			const responseId = answerReport(root, decision.published, "retry");
			const prepared = yield* fleet.resolve("one", decision.id, responseId);
			expect(prepared.value.stage).toBe("prepared");
			expect(prepared.value.boardContext).toBe(current);
			expect(prepared.value.decision).toBeUndefined();
			expect(prepared.value.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
			expect((yield* fleet.dispatch("one")).value.attempts.at(-1)?.prompt).toContain(current);
		}),
	));

test("a quota rejection cannot consume the changed brief or lose the worker's pending answer", () =>
	withFleetBoard({ quota: 1 }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			const answer = yield* answerWorker(root, decision);
			const current = `${source}\nNew approved criteria.\n`;
			boardHttpFiles(root).write("one.md", current);
			const waiting = yield* fleet.reconcile("one");
			expect(waiting.value.stage).toBe("needs-human");
			expect(waiting.value.boardContext).toBe(source);
			expect(waiting.value.responses).toBeUndefined();
			yield* fixture.restart(
				Effect.gen(function* () {
					const continued = yield* (yield* Fleet).reconcile("one");
					expect(continued.value.stage).toBe("executing");
					expect(continued.value.boardContext).toBe(current);
					expect(continued.value.attempts.at(-1)?.prompt).toContain(answer.body);
					expect(continued.value.attempts.at(-1)?.prompt).toContain(current);
					expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
				}),
				(policy) => ({ ...policy, quota: { ...policy.quota, available: 100 } }),
			);
		}),
	));
