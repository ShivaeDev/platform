import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("retains the continued worker thread when its new result still needs a human", () =>
	withEngine({ denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const stopped = yield* fleet.reconcile("one");
			const sessionId = stopped.value.attempts[0]?.receipt?.sessionId;
			expect(sessionId).toBeDefined();
			expect(stopped.value.stage).toBe("needs-human");
			yield* fleet.continue("one", "Repair the outstanding criterion");
			finishWorkers(fixture);
			const continued = yield* fleet.reconcile("one");
			expect(continued.value.stage).toBe("needs-human");
			expect(continued.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			expect(continued.value.attempts[0]?.receipt?.sessionId).toBe(sessionId);
			expect(fixture.archived).not.toContain(sessionId);
			expect(pendingSessionCleanup(continued.value)).not.toContain(sessionId);
		}),
	));

test("continues completed work on the same session and cleans up that session after the new completion", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const completed = yield* fleet.reconcile("one");
			const sessionId = completed.value.attempts[0]?.receipt?.sessionId;
			expect(sessionId).toBeDefined();
			expect(completed.value.stage).toBe("completed");
			expect(fixture.archived.filter((id) => id === sessionId)).toHaveLength(1);
			const continued = yield* fleet.continue("one", "Check one more case");
			expect(continued.value.attempts[0]?.receipt?.sessionId).toBe(sessionId);
			expect(continued.value.attempts[0]?.sessionCleanupComplete).toBeUndefined();
			yield* fleet.reconcile("one");
			expect(fixture.archived.filter((id) => id === sessionId)).toHaveLength(1);
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(fixture.archived.filter((id) => id === sessionId)).toHaveLength(2);
			expect(fixture.launched.filter((id) => id === "operation-1")).toHaveLength(1);
		}),
	));
