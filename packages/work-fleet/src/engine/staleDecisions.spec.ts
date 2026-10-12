import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { boardHttp, boardHttpFiles, boardInbox, boardOverview } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { answerReport } from "#test/report.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const status of ["planned", "deferred"]) {
	test(`a Board HTTP release closes a changed and moved ${status} task decision without current approval`, () =>
		withFleetBoard({ checksFailure: true, noChange: true }, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const decision = (yield* fleet.reconcile("one")).value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing decision");
				}
				const published = decision.published;
				expect(yield* boardInbox(root, "orchestrator")).toContain(`data-key="inbox:${published.sourcePath}"`);
				const files = boardHttpFiles(root);
				files.write("one.md", `---\nid: one\nkind: task\nstatus: ${status}\n---\n# Changed scope\n`);
				files.move("one.md", "moved.md");
				const { client } = yield* boardHttp(root);
				const answer = yield* Effect.tryPromise(() =>
					client.mutate(
						client.responses.recordResponse.run({
							answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
							author: "orchestrator",
							body: "Release ownership.",
							id: "response.changed.release",
							question: published.questionId,
							type: "answer",
						}),
					),
				);
				const released = yield* fleet.reconcile("one");
				expect(released.value.stage).toBe("released");
				expect(released.value.responses).toMatchObject([{ action: "release", boardAcknowledged: true, responseId: answer.id }]);
				expect(yield* boardOverview(root)).not.toContain(`data-attention-item="${published.itemId}"`);
				expect(yield* boardInbox(root, "orchestrator")).not.toContain('data-key="inbox:');
				yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decision.id, answer.id))));
				expect(files.receipts()).toHaveLength(1);
				expect(fixture.launched).toHaveLength(2);
			}),
		));
}

test("concurrent retries cannot authorize a changed brief or consume the original answer", () =>
	withFleetBoard({ checksFailure: true, noChange: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const decision = (yield* fleet.reconcile("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing decision");
			}
			const files = boardHttpFiles(root);
			const currentSource = `${source}\nChanged criteria.\n`;
			files.write("one.md", currentSource);
			const answer = answerReport(root, decision.published, "retry");
			yield* Effect.all(
				[fleet.resolve("one", decision.id, answer).pipe(Effect.result), fleet.resolve("one", decision.id, answer).pipe(Effect.result)],
				{ concurrency: "unbounded" },
			);
			const prepared = (yield* fleet.get("one")).value;
			expect(prepared.stage).toBe("needs-human");
			expect(prepared.boardContext).toBe(source);
			expect(prepared.decision).toEqual(decision);
			expect(prepared.responses).toBeUndefined();

			expect(yield* boardOverview(root)).toContain("data-attention-item=");
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const denied = yield* restarted.resolve("one", decision.id, answer).pipe(Effect.result);
					expect(denied._tag).toBe("Failure");
					const stopped = yield* restarted.reconcile("one");
					expect(stopped.value.stage).toBe("needs-human");
					expect(stopped.value.decision?.reason).toBe("Board context changed");
					expect(stopped.value.responses).toBeUndefined();
				}),
			);
			expect(files.receipts()).toHaveLength(1);
			expect(fixture.launched).toHaveLength(2);
		}),
	));

test("a worker answer cannot continue its thread after an authored brief edit", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			yield* answerWorker(root, decision);
			const current = `${source}\nChanged criteria.\n`;
			boardHttpFiles(root).write("one.md", current);
			const continued = yield* fleet.reconcile("one");
			expect(continued.value.stage).toBe("needs-human");
			expect(continued.value.decision?.reason).toBe("Board context changed");
			expect(continued.value.boardContext).toBe(source);
			expect(continued.value.responses).toBeUndefined();
			expect(continued.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
		}),
	));
