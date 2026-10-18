import { Effect } from "effect";
import type { WorkResult } from "#policy.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineLaunchVerbs(state: EngineStory, tell: (line: string) => void) {
	function fixture() {
		return running(state).fixture;
	}
	return {
		failNextObservation: (turnId: string) => {
			if (!fixture().observations.has(turnId)) {
				throw new Error(`No accepted turn ${turnId} is available to fail observation`);
			}
			fixture().failedObservations.add(turnId);
			tell(`the next observation of ${turnId} fails`);
		},
		hasLaunchRetry: () =>
			Effect.suspend(() => {
				tell("read the launch retry projection");
				return running(state).fleet.hasLaunchRetry();
			}),
		loseResultOwnership: () => {
			if (state.resultObservation === undefined) {
				throw new Error("No mutable worker result is configured");
			}
			state.resultObservation.unavailable = true;
			tell("worker result ownership becomes unavailable");
		},
		previousHasLaunchRetry: () =>
			Effect.suspend(() => {
				if (state.previousFleet === undefined) {
					return Effect.die("No previous Fleet instance is available; restart Fleet first");
				}
				tell("read the launch retry projection from the previous Fleet instance");
				return state.previousFleet.hasLaunchRetry();
			}),
		setObservedResult: (result: WorkResult) => {
			if (state.resultObservation === undefined) {
				throw new Error("No mutable worker result is configured");
			}
			state.resultObservation.value = result;
			tell(`observe worker result at ${result.head}`);
		},
	};
}
