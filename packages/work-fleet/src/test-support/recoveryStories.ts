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

export const lostThreadRestartStory = {
	code: "session-ambiguous",
	name: "lost thread restarts stop at the budget and resume after an orchestrator answer",
	sites: ["engine/retryLostThread.ts: failureCode(error)"],
	spec: "lostThreadRestart.spec.ts",
};

export const stopWorkStory = {
	code: "fleet-invalid",
	name: "stop interrupts working Codex work and closes its Board response",
	sites: ['engine/stopCommand.ts: "fleet-invalid"'],
	spec: "host/stopWork.spec.ts",
};

export const recoveryStories = [
	stopWorkStory,
	publicationRecoveryStory,
	terminalBriefRecoveryStory,
	lostThreadRestartStory,
	{
		code: "report-revision",
		name: "stale research is refused and can be safely released after restart",
		sites: ['engine/completeReport.ts: "report-revision"'],
		spec: "reportCurrentMain.spec.ts",
	},
];
