import { addShapeColumns } from "#storage/addShapeColumns.ts";

const document = {
	fields: {
		publication: {
			fields: {
				itemId: "string",
				receipt: { fields: { sessionId: "string", turnId: "string" } },
				revision: "string",
				sourcePath: "string",
				workRevision: "string",
			},
		},
		tldr: "string",
	},
} as const;
const prior = { decision: { fields: {} }, review: { fields: {} } } as const;
const fields = { decision: { fields: { review: document } }, review: { fields: { document } }, reviewAdvisoryHead: "string" } as const;
const before = { fields: { ...prior, history: { array: { fields: prior } } } } as const;
const after = { fields: { ...fields, history: { array: { fields } } } } as const;

export function advisoryReviews(namespace: string) {
	return addShapeColumns(namespace, before, after);
}
