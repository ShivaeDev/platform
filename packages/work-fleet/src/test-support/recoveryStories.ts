export const publicationRecoveryStory = {
	code: "session-turn-missing",
	name: "an answer to a lost-turn question repairs its existing PR after publication reads recover",
	registration: "publicationRecoveryStory.name",
	sites: ['engine/recoverMissingTurn.ts: "session-turn-missing"'],
	spec: "missingTurnRecovery.spec.ts",
};

export const recoveryStories = [publicationRecoveryStory];
