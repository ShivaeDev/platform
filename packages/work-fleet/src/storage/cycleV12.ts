import { preparationV12 } from "#storage/preparationV12.ts";
import type { Shape } from "#storage/recordShape.ts";
import { decisionV12, responsesV12, supersededDecisionsV12 } from "#storage/typedDecisionsV12.ts";

export const cycleV12 = {
	fields: {
		admissionReady: "boolean",
		areas: { array: "string" },
		attentionOwner: "string",
		blocker: "string",
		boardContext: "string",
		boardRevision: "string",
		boardSourcePath: "string",
		checks: {
			fields: {
				evidence: { array: "string" },
				failedChecks: { array: "string" },
				head: "string",
				passed: "boolean",
				pending: "boolean",
				repairPrompt: "string",
			},
		},
		completedAt: "number",
		conflictRepairs: { array: "string" },
		cwd: "string",
		decision: decisionV12,
		decisionAcknowledged: "boolean",
		decisionPublished: "boolean",
		deliverable: "string",
		integrationRetry: {
			fields: {
				error: "string",
				failures: "number",
				retryAt: "number",
			},
		},
		launch: {
			fields: {
				effort: "string",
				model: "string",
				serviceTier: "string",
			},
		},
		launchRetry: {
			fields: {
				prompt: "string",
				rejectedAt: "number",
				rejections: "number",
				retryAt: "number",
			},
		},
		mergeAreasReleased: "boolean",
		mergeReadyAt: "number",
		mergeReadyHead: "string",
		outcome: {
			fields: {
				evidence: { array: "string" },
				head: "string",
				revision: "string",
				url: "string",
			},
		},
		pendingAnswers: { array: "string" },
		preparation: preparationV12,
		prompt: "string",
		releaseReason: "string",
		report: {
			fields: {
				itemId: "string",
				receipt: {
					fields: {
						sessionId: "string",
						turnId: "string",
					},
				},
				revision: "string",
				sourcePath: "string",
				workRevision: "string",
			},
		},
		responses: responsesV12,
		result: {
			fields: {
				evidence: { array: "string" },
				head: "string",
				kind: "string",
				paths: { array: "string" },
				pr: "string",
				prNumber: "number",
			},
		},
		resultObservations: {
			array: {
				fields: {
					evidence: { array: "string" },
					head: "string",
					kind: "string",
					paths: { array: "string" },
					pr: "string",
					prNumber: "number",
				},
			},
		},
		review: {
			fields: {
				evidence: { array: "string" },
				findings: { array: "string" },
				head: "string",
				receipt: {
					fields: {
						sessionId: "string",
						turnId: "string",
					},
				},
				repairPrompt: "string",
				verdict: "string",
			},
		},
		stage: "string",
		stageEnteredAt: "number",
		supersededDecisions: supersededDecisionsV12,
		updatedAt: "number",
	},
} as const satisfies Shape;
