import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { type EngineFixture, finishWorkers, prepareWork } from "#test/engine.ts";
import { REPORT } from "#test/githubResult.ts";

export const reportWorker = Effect.fn("Test.reportWorker")(function* (fixture: EngineFixture) {
	yield* prepareWork("one");
	const fleet = yield* Fleet;
	yield* fleet.dispatch("one");
	finishWorkers(fixture);
	for (const [turn, observation] of fixture.observations) {
		fixture.observations.set(turn, { ...observation, output: REPORT });
	}
});
