import { expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker, QUESTION } from "#test/workerQuestion.ts";

const test = postgresTests("test", "isolated");

test("concurrent answers commit one continuation and recover its lost acknowledgement after restart", () =>
	withFleetBoard({ lostContinuationAcknowledgement: true }, (fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			const answer = yield* answerWorker(root, decision);
			yield* Effect.all(
				[fleet.resolve("one", decision.id, answer.id).pipe(Effect.result), fleet.resolve("one", decision.id, answer.id).pipe(Effect.result)],
				{ concurrency: "unbounded" },
			);
			const intent = (yield* fleet.get("one")).value;
			expect(intent.attempts).toHaveLength(2);
			expect(intent.attempts.at(-1)?.receipt).toBeUndefined();
			expect(intent.attempts.at(-1)?.sessionId).toBe(decision.worker?.sessionId);
			expect(intent.attempts.at(-1)?.prompt).toBe(answer.body);
			expect(intent.responses).toHaveLength(1);
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const recovered = yield* restarted.reconcile("one");
					expect(recovered.value.step).toBe("working");
					expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).toBe(decision.worker?.sessionId);
					yield* restarted.resolve("one", decision.id, answer.id);
				}),
			);
			expect(fixture.launched).toHaveLength(1);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
		}),
	));

for (const type of ["clarify", "not_now"] as const) {
	test(`${type} keeps the worker question open until an explicit superseding answer`, () =>
		withFleetBoard({}, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const { decision } = yield* askWorker(fixture);
				const deferred = yield* answerWorker(root, decision, "response.deferred", type);
				expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
				const answer = yield* answerWorker(root, decision, "response.superseding", "answer", deferred.id);
				expect((yield* fleet.reconcile("one")).value.step).toBe("working");
				expect((yield* fleet.get("one")).value.attempts.at(-1)?.prompt).toBe(answer.body);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			}),
		));
}

test("closing the Board task supersedes competing worker answers", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			yield* answerWorker(root, decision, "response.first");
			yield* answerWorker(root, decision, "response.second", "answer", undefined, "orchestrator");
			const competing = yield* fleet.reconcile("one");
			expect(competing.value.step).toBe("waiting");
			expect(competing.value.blocker).toContain("Several Board answers compete");
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* fs.writeFileString(path.join(root, "one.md"), source.replace("kind: task", "kind: task\nstatus: done\nnext_action: Work completed."));
			const stale = yield* fleet.reconcile("one");
			expect(stale.value.step).toBe("released");
			expect(stale.value.releaseReason).toBe("Board status is done");
			expect(stale.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
		}),
	));

test("worker question publication retries the stored exact question without another worker launch", () =>
	withEngine({ publishFailure: true }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			for (const [id, observation] of fixture.observations) {
				fixture.observations.set(id, { ...observation, execution: "completed", output: `FLEET_QUESTION: ${QUESTION}` });
			}
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.decisionPublished).toBe(false);
			expect(failed.value.decision?.reason).toBe(QUESTION);
			expect(failed.value.decision?.worker).toEqual(failed.value.attempts[0]?.receipt);
			yield* fixture.restart(
				Effect.gen(function* () {
					const recovered = yield* (yield* Fleet).reconcile("one");
					expect(recovered.value.step).toBe("waiting");
					expect(recovered.value.decisionPublished).toBe(true);
					expect(recovered.value.decision?.reason).toBe(QUESTION);
				}),
			);
			expect(fixture.decisions).toHaveLength(1);
			expect(fixture.launched).toHaveLength(1);
		}),
	));
