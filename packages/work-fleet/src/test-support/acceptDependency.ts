import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { type EngineFixture, finishWorkers } from "#test/engine.ts";

export const acceptDependency = Effect.fn("Test.acceptDependency")(function* (fixture: EngineFixture) {
	const fleet = yield* Fleet;
	yield* fleet.dispatch("one");
	finishWorkers(fixture);
	return yield* fleet.reconcile("one");
});
