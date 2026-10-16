import type { Attempt } from "#model.ts";

export const migrationReceipt = { sessionId: "session", turnId: "turn" };
export const migrationSettings = { effort: "high", model: "model", serviceTier: "tier" };
export const typedMigrationAttempt: Attempt = {
	checkFailures: ["failed", "failed"],
	missingSince: 0,
	observationRetries: 2,
	operationId: "operation",
	output: 'Unicode Ω\nquoted "text" and \\slashes',
	progress: { at: 1, signature: "signature" },
	prompt: "",
	providerFailures: 3,
	readRetry: { error: "read error", failures: 4, retryAt: 5 },
	receipt: migrationReceipt,
	reviewHead: "review-head",
	reviewRevision: "review-revision",
	role: "worker",
	sessionCleanupComplete: false,
	sessionId: "session",
	sessionUnusable: false,
	settings: migrationSettings,
	stallRecovery: { count: 6, interruptedAt: 7, interruptRequestedAt: 8, lastActionAt: 9, steeredAt: 10 },
	status: "completed",
	submissionTimedOut: true,
	submissionUncertain: false,
	submittedAt: 11,
	terminalReceipts: [migrationReceipt, { sessionId: "other-session", turnId: "other-turn" }],
};
