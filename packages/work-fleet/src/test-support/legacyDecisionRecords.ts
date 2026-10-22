const published = { itemId: "request", revision: "original" };
const history = [
	{
		decision: {
			published,
			reason: "Worker report exceeds Board’s 256 KiB context limit, including metadata and receipt; request a shorter report before retrying.",
		},
	},
	{ decision: { code: "foreign-pr", published, reason: "Reworded saved decision" } },
	{ decision: { reason: "Question text", worker: { sessionId: "thread", turnId: "turn" } } },
	{ decision: { reason: "PR conflicts with main; inspect the conflict repair before retrying or releasing this work" } },
	{ decision: { reason: "Codex rejected the protocol request: turn already active for thread; active-turn resubmission limit reached" } },
];
export const legacyDecisionRecord = {
	decision: { published, reason: "Reviewed PR is ready to merge" },
	history,
	stage: "needs-human",
	workId: "one",
};
export const codedDecisionRecord = {
	...legacyDecisionRecord,
	decision: { ...legacyDecisionRecord.decision, code: "reviewed-pr-ready" },
	history: [
		{ decision: { ...history[0]?.decision, code: "report-too-large" } },
		history[1],
		{ decision: { ...history[2]?.decision, code: "worker-question" } },
		{ decision: { ...history[3]?.decision, code: "pr-conflicting" } },
		{ decision: { ...history[4]?.decision, code: "session-active-turn-exhausted" } },
	],
	stage: "waiting",
	step: "waiting",
};
