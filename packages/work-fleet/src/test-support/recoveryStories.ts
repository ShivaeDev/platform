export const publicationRecoveryStory = {
	code: "session-turn-missing",
	name: "an answer to a lost-turn question repairs its existing PR after publication reads recover",
	sites: ['engine/recoverMissingTurn.ts: "session-turn-missing"', 'engine/guardLostTurn.ts: "session-turn-missing"'],
	spec: "missingTurnRecovery.spec.ts",
};

const terminalBriefRecoveryStory = {
	code: "fleet-stale",
	name: "a changed brief after a finished worker turn supports retry and release after restart",
	sites: ['engine/boardBrief.ts: "fleet-stale"', "engine/reconcileCommand.ts: failureCode(error)"],
	spec: "approvedTerminalBrief.spec.ts",
};

export const recoveryStories = [publicationRecoveryStory, terminalBriefRecoveryStory];
