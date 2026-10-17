import type { Shape } from "#storage/recordShape.ts";

export const preparationV12 = {
	fields: {
		baselinePaths: { array: "string" },
		baseRevision: "string",
		configuration: {
			array: {
				fields: {
					path: "string",
					relevantKeys: { array: "string" },
				},
			},
		},
		contextComplete: "boolean",
		dependencyPaths: { array: "string" },
		observedAt: "number",
		ownedPaths: { array: "string" },
		qualityPaths: { array: "string" },
		setupPaths: { array: "string" },
		sourcePaths: { array: "string" },
		validation: {
			array: {
				fields: {
					command: "string",
					revision: "string",
				},
			},
		},
	},
} as const satisfies Shape;
