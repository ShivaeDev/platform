import type { Attempt } from "#model.ts";

export const migrationReceipt = { sessionId: "session", turnId: "turn" };
export const migrationSettings = { effort: "high", model: "model", serviceTier: "tier" };
const typedMigrationAttempt: Attempt = {
	abandoned: {
		at: 0,
		interruptError: "Interrupt failed",
		observation: {
			capacity: "serverOverloaded",
			error: "Provider error",
			execution: "interrupted",
			output: 'Retained Ω\n"provider output"',
			progress: [{ id: "first", status: "completed" }, { id: "second" }],
			provisioning: "ready",
			receipt: migrationReceipt,
			turnMissing: false,
		},
		observationError: "Observation failed",
	},
	briefSteers: [
		{ requestedAt: 0, revision: "pending-revision" },
		{ error: 'Steer failed: Ω\n"quoted"', requestedAt: 1, revision: "failed-revision" },
		{ requestedAt: 2, revision: "steered-revision", steeredAt: 0 },
	],
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

export const typedMigrationAttempts: readonly Attempt[] = [
	typedMigrationAttempt,
	{
		...typedMigrationAttempt,
		abandoned: {
			at: 1,
			observation: { execution: "failed", output: "", progress: [], provisioning: "unknown", receipt: migrationReceipt, turnMissing: true },
		},
		briefSteers: [],
		operationId: "second",
		settings: {},
		terminalReceipts: [],
	},
	{ operationId: "third", role: "worker", status: "completed", submittedAt: 12 },
	{ abandoned: { at: 2 }, operationId: "fourth", role: "worker", status: "failed", submittedAt: 13 },
	{
		abandoned: { at: 3, observation: { execution: "accepted", output: "", provisioning: "unknown", receipt: migrationReceipt } },
		operationId: "fifth",
		role: "worker",
		status: "failed",
		submittedAt: 14,
	},
];
