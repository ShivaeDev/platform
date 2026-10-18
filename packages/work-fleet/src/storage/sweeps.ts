import { addShapeColumns } from "#storage/addShapeColumns.ts";

const fields = {
	decision: { fields: { publicationWork: { fields: { sweep: { array: "string" } } } } },
	sweep: { array: "string" },
	sweepClosed: "boolean",
	sweepHold: { fields: { context: "string", operationId: "string", workId: "string" } },
} as const;
const decision = { fields: { publicationWork: { fields: {} } } } as const;
const before = { fields: { decision, history: { array: { fields: { decision } } } } } as const;
const after = { fields: { ...fields, history: { array: { fields } } } } as const;

export function sweeps(namespace: string) {
	return addShapeColumns(namespace, before, after);
}
