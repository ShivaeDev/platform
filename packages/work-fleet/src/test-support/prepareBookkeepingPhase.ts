import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { type EngineFixture, finishWorkers, prepareWork } from "#test/engine.ts";
import { askWorker } from "#test/workerQuestion.ts";

export const prepareBookkeepingPhase = Effect.fn("Fleet.prepareBookkeepingPhase")(function* (fixture: EngineFixture<unknown>, phase: string) {
	const fleet = yield* Fleet;
	yield* prepareWork("one");
	if (phase !== "preparation") {
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
	}
	if (["review", "completed"].includes(phase)) {
		finishWorkers(fixture);
		yield* fleet.reconcile("one");
	} else if (phase === "decision") {
		yield* askWorker(fixture);
	}
	return yield* fleet.get("one");
});
