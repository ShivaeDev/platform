import type { Shape } from "#storage/recordShape.ts";
import { shapeV14 } from "#storage/shapeV14.ts";

const attempt = { fields: { ...shapeV14.fields.attempts.array.fields, publishedRecovery: "boolean" } } as const;
const cycle = { ...shapeV14.fields, attempts: { array: attempt } };
export const shapeV15 = {
	fields: {
		...cycle,
		history: { array: { fields: { ...shapeV14.fields.history.array.fields, attempts: { array: attempt } } } },
	},
} as const satisfies Shape;
