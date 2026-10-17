import type { Shape } from "#storage/recordShape.ts";

export const decisionV12 = {
	fields: {
		attentionOwner: "string",
		boardAcknowledgementDisposition: "string",
		code: "string",
		id: "string",
		links: { array: "string" },
		publicationWork: {
			fields: {
				approved: "boolean",
				areas: { array: "string" },
				context: "string",
				deliverable: "string",
				dependsOn: { array: "string" },
				revision: "string",
				sourcePath: "string",
				status: "string",
				workId: "string",
			},
		},
		published: {
			fields: {
				itemId: "string",
				questionId: "string",
				request: "string",
				revision: "string",
				sourcePath: "string",
				workId: "string",
				workRevision: "string",
				workSourcePath: "string",
			},
		},
		reason: "string",
		recommendation: "string",
		worker: {
			fields: {
				sessionId: "string",
				turnId: "string",
			},
		},
	},
} as const satisfies Shape;

export const responsesV12 = {
	array: {
		fields: {
			action: "string",
			boardAcknowledged: "boolean",
			boardAcknowledgementDisposition: "string",
			decisionId: "string",
			processedAt: "number",
			published: {
				fields: {
					itemId: "string",
					questionId: "string",
					request: "string",
					revision: "string",
					sourcePath: "string",
					workId: "string",
					workRevision: "string",
					workSourcePath: "string",
				},
			},
			questionId: "string",
			questionRevision: "string",
			responseId: "string",
			type: "string",
		},
	},
} as const satisfies Shape;

export const supersededDecisionsV12 = {
	array: {
		fields: {
			boardAcknowledged: "boolean",
			boardAcknowledgementDisposition: "string",
			published: {
				fields: {
					itemId: "string",
					questionId: "string",
					request: "string",
					revision: "string",
					sourcePath: "string",
					workId: "string",
					workRevision: "string",
					workSourcePath: "string",
				},
			},
			reassignedTo: {
				fields: {
					attentionOwner: "string",
					decisionId: "string",
				},
			},
			supersededAt: "number",
		},
	},
} as const satisfies Shape;
