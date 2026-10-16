import type { Shape } from "#storage/recordShape.ts";

export const attemptV12 = {
	fields: {
		checkFailures: { array: "string" },
		missingSince: "number",
		observationRetries: "number",
		operationId: "string",
		output: "string",
		progress: {
			fields: {
				at: "number",
				signature: "string",
			},
		},
		prompt: "string",
		providerFailures: "number",
		readRetry: {
			fields: {
				error: "string",
				failures: "number",
				retryAt: "number",
			},
		},
		receipt: {
			fields: {
				sessionId: "string",
				turnId: "string",
			},
		},
		reviewHead: "string",
		reviewRevision: "string",
		role: "string",
		sessionCleanupComplete: "boolean",
		sessionId: "string",
		sessionUnusable: "boolean",
		settings: {
			fields: {
				effort: "string",
				model: "string",
				serviceTier: "string",
			},
		},
		stallRecovery: {
			fields: {
				count: "number",
				interruptedAt: "number",
				interruptRequestedAt: "number",
				lastActionAt: "number",
				steeredAt: "number",
			},
		},
		status: "string",
		submissionTimedOut: "boolean",
		submissionUncertain: "boolean",
		submittedAt: "number",
		terminalReceipts: {
			array: {
				fields: {
					sessionId: "string",
					turnId: "string",
				},
			},
		},
	},
} as const satisfies Shape;
