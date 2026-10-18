import { Deferred } from "effect";
import { requireCapability } from "#test/engineCapabilities.ts";
import type { EngineStory } from "#test/engineState.ts";
export function engineWorldVerbs(state: EngineStory, tell: (line: string) => void) {
	function change(line: string, action: () => void) {
		action();
		tell(line);
	}
	return {
		advanceTime: (ms: number) =>
			change(`advance Fleet time by ${ms}ms`, () => {
				state.now += ms;
			}),
		currentTime: () => state.now,
		missingReviewOperation: () => state.missingReviewOperation,
		providerReadCount: () => state.providerReads,
		providerRecoveries: () => structuredClone(state.missingTurns?.recoveries ?? []),
		providerRequests: () => [...(state.missingTurns?.requests ?? [])],
		recoverProvider: () =>
			change("the provider accepts submissions again", () => {
				requireCapability(state, "providerRejection");
				state.providerRejects = false;
			}),
		rejectProvider: () =>
			change("the provider rejects new submissions", () => {
				requireCapability(state, "providerRejection");
				state.providerRejects = true;
			}),
		restoreTerminalEvidence: (turn: string) =>
			change(`the provider restores terminal evidence for ${turn}`, () => {
				if (state.nativeTurns === undefined || !state.nativeTurns.states.has(turn)) {
					throw new Error("No matching native turn is configured");
				}
				state.terminalEvidenceRestored = true;
				state.nativeTurns.states.set(turn, "completed");
			}),
		resumeMovedHeadWrites: () =>
			change("allow moved-head writes after the interruption", () => {
				if (state.launching === undefined) {
					throw new Error("No moved-head write gate is configured");
				}
				state.movedWriteResumed = true;
			}),
		resumeReviewer: () => {
			if (state.reviewResume === undefined) {
				throw new Error("No reviewer gate is configured");
			}
			tell("allow the reviewer to finish");
			return Deferred.succeed(state.reviewResume, undefined);
		},
		waitForMovedHeadWrite: () => {
			if (state.launching === undefined) {
				throw new Error("No moved-head write gate is configured");
			}
			tell("wait until the moved head is persisted");
			return Deferred.await(state.launching);
		},
		waitForReviewObservation: () => {
			if (state.observing === undefined) {
				throw new Error("No review observation gate is configured");
			}
			tell("wait until the reviewer reaches observation");
			return Deferred.await(state.observing);
		},
	};
}
