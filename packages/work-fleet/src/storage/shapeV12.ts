import { attemptV12 } from "#storage/attemptV12.ts";
import { cycleV12 } from "#storage/cycleV12.ts";
import type { Shape } from "#storage/recordShape.ts";

const cycle = { ...cycleV12.fields, attempts: { array: attemptV12 } };
export const shapeV12 = {
	fields: {
		...cycle,
		history: { array: { fields: { ...cycle, archivedAt: "number" } } },
	},
} as const satisfies Shape;
