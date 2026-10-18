import type { Shape } from "#storage/recordShape.ts";
import { shapeV14 } from "#storage/shapeV14.ts";

const { admissionReady: _admissionReady, ...cycle } = shapeV14.fields;
const { admissionReady: _archivedAdmissionReady, ...archived } = shapeV14.fields.history.array.fields;
const attempt = { fields: { ...shapeV14.fields.attempts.array.fields, publishedRecovery: "boolean" } } as const;
export const shapeV17 = {
	fields: {
		...cycle,
		attempts: { array: attempt },
		history: { array: { fields: { ...archived, attempts: { array: attempt } } } },
	},
} as const satisfies Shape;
