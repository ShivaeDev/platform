import { attemptV12 } from "#storage/attemptV12.ts";
import { cycleV12 } from "#storage/cycleV12.ts";
import type { Shape } from "#storage/recordShape.ts";
import { decisionV12 } from "#storage/typedDecisionsV12.ts";

const attempt = { fields: { ...attemptV12.fields, overLimit: "boolean" } } as const;
const publicationWork = { fields: { ...decisionV12.fields.publicationWork.fields, priority: "string" } } as const;
const cycle = {
	...cycleV12.fields,
	attempts: { array: attempt },
	decision: { fields: { ...decisionV12.fields, publicationWork } },
	dispatchNow: { fields: { ignoreAreas: "boolean" } },
} as const;
export const shapeV14 = {
	fields: {
		...cycle,
		history: { array: { fields: { ...cycle, archivedAt: "number" } } },
	},
} as const satisfies Shape;
