import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { type EngineFixture, finishWorkers, prepareWork } from "#test/engine.ts";

export const deniedDecision = Effect.fn("Test.deniedDecision")(function* (fixture: EngineFixture) {
	yield* prepareWork("one");
	const fleet = yield* Fleet;
	yield* fleet.dispatch("one");
	finishWorkers(fixture);
	const denied = yield* fleet.reconcile("one");
	const decision = denied.value.decision;
	return decision === undefined ? yield* Effect.die("Expected concrete delivery decision") : decision;
});
