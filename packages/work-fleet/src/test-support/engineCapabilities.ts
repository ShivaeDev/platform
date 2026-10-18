import type { EngineStory } from "#test/engineState.ts";

export type EngineCapability =
	| "closePullRequest"
	| "conflictPullRequest"
	| "editBoardAtCompletion"
	| "editBoardDuringAssessment"
	| "githubAvailability"
	| "mergePullRequest"
	| "movePullRequestHead"
	| "providerRejection"
	| "restoreDeliveryEvidence";

export function requireCapability(state: EngineStory, action: EngineCapability, hasTarget = false) {
	if (!(hasTarget || state.capabilities.has(action))) {
		throw new Error(`Cannot ${action}: no configured target`);
	}
}
