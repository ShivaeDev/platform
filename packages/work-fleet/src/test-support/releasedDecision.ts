import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";

export function decisionPublicationFails() {
	return engineConfiguration("the Board cannot register the decision question", () => ({ publishFailure: true }));
}

export function releasedUnpublishedDecision(owner: "maintainer" | "orchestrator" = "orchestrator") {
	return engine.trait("work", `a pre-existing released record retains an unpublished decision owned by the ${owner}`, function* (state: EngineStory) {
		const { fleet, fixture } = running(state);
		fixture.boardStatus("one", "planned");
		yield* prepareWork("one").pipe(Effect.provideService(Fleet, fleet));
		yield* fleet.dispatch("one");
		finishWorkers(fixture);
		const waiting = (yield* fleet.reconcile("one")).value;
		if (waiting.decision === undefined || waiting.decision.published !== undefined) {
			return yield* Effect.die("Expected an unpublished Fleet decision");
		}
		yield* fixture.replaceRecord({
			...waiting,
			attentionOwner: owner,
			blocker: "Board question did not register",
			releaseReason: "Released after decision publication failed",
			step: "released",
		});
	});
}
