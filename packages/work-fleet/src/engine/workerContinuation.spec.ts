import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test", "isolated");

test("interruption before provider submission retains the answer intent without replaying it after restart", function* () {
	const entered = yield* Deferred.make<void>();
	const continuationGate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never));
	return yield* withFleetBoard({ continuationGate }, (fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			const answer = yield* answerWorker(root, decision);
			const resolving = yield* fleet.resolve("one", decision.id, answer.id).pipe(Effect.forkChild);
			yield* Deferred.await(entered);
			yield* Fiber.interrupt(resolving);
			const intent = (yield* fleet.get("one")).value;
			expect(intent.responses).toHaveLength(1);
			expect(intent.attempts.at(-1)?.prompt).toBe(answer.body);
			expect(intent.attempts.at(-1)?.sessionId).toBe(decision.worker?.sessionId);
			expect(intent.attempts.at(-1)?.receipt).toBeUndefined();
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const uncertain = yield* restarted.reconcile("one");
					expect(uncertain.value.step).toBe("waiting");
					expect(uncertain.value.decision?.reason).toBe("No authoritative operation receipt");
					yield* restarted.resolve("one", decision.id, answer.id);
				}),
			);
			expect(fixture.operations.size).toBe(1);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
		}),
	);
});

test("a recorded worker answer cannot continue without fresh available quota", () =>
	withFleetBoard({ quota: 1 }, (fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			yield* answerWorker(root, decision);
			const blocked = yield* fleet.reconcile("one");
			expect(blocked.value.step).toBe("waiting");
			expect(blocked.value.blocker).toBe("Fresh available provider quota is required");
			expect(blocked.value.attentionOwner).toBe("automation");
			expect(blocked.value.responses ?? []).toHaveLength(0);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
		}),
	));

test("a recorded answer waits on automation while capacity is occupied and is adopted when capacity returns", () =>
	withFleetBoard({ concurrency: 1 }, (fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			const fs = yield* FileSystem.FileSystem;
			yield* fs.writeFileString(`${root}/two.md`, "---\nid: two\nkind: task\nfleet: approved\n---\n# Other work\n");
			yield* prepareWork("two");
			yield* fleet.dispatch("two");
			const answer = yield* answerWorker(root, decision);
			const blocked = (yield* fleet.reconcile("one")).value;
			expect(blocked.attentionOwner).toBe("automation");
			expect(blocked.blocker).toBe("execution capacity is occupied (limit 1)");
			expect(blocked.responses ?? []).toHaveLength(0);
			finishWorkers(fixture);
			yield* fleet.reconcile("two");
			const continued = (yield* fleet.reconcile("one")).value;
			expect(continued.step).toBe("working");
			expect(continued.responses).toMatchObject([{ responseId: answer.id }]);
			expect(continued.attempts.at(-1)?.prompt).toBe(answer.body);
		}),
	));
