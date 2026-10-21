import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");

test("continuation refuses a missing worker receipt and an empty message", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			fixture.editWork("one", "changed-board");
			expect((yield* fleet.dispatch("one")).value.step).toBe("waiting");
			expect(yield* fleet.continue("one", " \n").pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
			expect(yield* fleet.continue("one", "No worker").pipe(Effect.flip)).toMatchObject({ message: "Continue requires an existing worker receipt" });
			expect(fixture.operations.size).toBe(0);
		}),
	));

test("continuation confirms that the worker still exists and is terminal", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			const dispatched = yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			const turnId = dispatched.value.attempts[0]?.receipt?.turnId ?? "missing";
			fixture.failedObservations.add(turnId);
			expect(yield* fleet.continue("one", "Thread unavailable").pipe(Effect.flip)).toMatchObject({ reason: "unavailable" });
			const observation = fixture.observations.get(turnId);
			if (observation === undefined) {
				return yield* Effect.die("Missing fixture observation");
			}
			fixture.observations.set(turnId, { ...observation, execution: "running" });
			expect(yield* fleet.continue("one", "Provider still running").pipe(Effect.flip)).toMatchObject({
				message: "The existing worker turn is still running",
			});
			expect(fixture.operations.size).toBe(2);
		}),
	));

test("continuation keeps quota accounting for archived attempts", () =>
	withEngine({ noChange: true, quota: 2 }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			expect(yield* fleet.continue("one", "Over quota").pipe(Effect.flip)).toMatchObject({ message: "Fresh available provider quota is required" });
			expect((yield* fleet.get("one")).value.step).toBe("done");
			expect(fixture.operations.size).toBe(2);
		}),
	));

test("a rejected continued turn preserves its thread for the next manual instruction", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			fixture.rejectNextTurn();
			const rejected = yield* fleet.continue("one", "Rejected instruction");
			expect(rejected.value.step).toBe("waiting");
			expect(rejected.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			expect(rejected.value.attempts[0]?.status).toBe("failed");
			const retried = yield* fleet.continue("one", "Accepted instruction");
			expect(retried.value.step).toBe("working");
			expect(retried.value.attempts[0]?.receipt?.sessionId).toBe("session-operation-1");
			expect(fixture.launched).toHaveLength(2);
		}),
	));
