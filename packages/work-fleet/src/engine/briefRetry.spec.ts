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

test("retry of receiptless preparation cannot authorize an edited brief", () =>
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
			const denied = yield* fleet.resolve("one", decision.id, responseId).pipe(Effect.result);
			expect(denied._tag).toBe("Failure");
			const prepared = yield* fleet.get("one");
			expect(prepared.value.stage).toBe("needs-human");
			expect(prepared.value.boardContext).toBe(source);
			expect(prepared.value.decision).toEqual(decision);
			expect(prepared.value.responses).toBeUndefined();
			expect((yield* fleet.dispatch("one")).value.attempts).toEqual([]);
		}),
	));

test("a quota increase cannot authorize a changed brief or consume the worker's pending answer", () =>
	withFleetBoard({ quota: 1 }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			yield* answerWorker(root, decision);
			const current = `${source}\nNew approved criteria.\n`;
			boardHttpFiles(root).write("one.md", current);
			const waiting = yield* fleet.reconcile("one");
			expect(waiting.value.stage).toBe("needs-human");
			expect(waiting.value.boardContext).toBe(source);
			expect(waiting.value.responses).toBeUndefined();
			yield* fixture.restart(
				Effect.gen(function* () {
					const continued = yield* (yield* Fleet).reconcile("one");
					expect(continued.value.stage).toBe("needs-human");
					expect(continued.value.decision?.reason).toBe("Board context changed");
					expect(continued.value.boardContext).toBe(source);
					expect(continued.value.responses).toBeUndefined();
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
					expect(boardHttpFiles(root).receipts()).toHaveLength(1);
				}),
				(policy) => ({ ...policy, quota: { ...policy.quota, available: 100 } }),
			);
		}),
	));
