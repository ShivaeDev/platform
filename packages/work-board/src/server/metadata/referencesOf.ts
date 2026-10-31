import type { MetadataDocument } from "#integration/metadata.ts";

export function referencesOf(document: MetadataDocument) {
	const { fields } = document.parsed;
	return [
		...(fields.handoff ? [{ field: "handoff", key: "handoff.item", target: fields.handoff.item }] : []),
		...(fields.question ? [{ field: "question", key: "question.item", target: fields.question.item }] : []),
		...(fields.response ? [{ field: "response", key: "response.question", target: fields.response.question }] : []),
		...(fields.response?.supersedes ? [{ field: "response", key: "response.supersedes", target: fields.response.supersedes }] : []),
		...(fields.requestReceipt ? [{ field: "request_receipt", key: "request_receipt.question", target: fields.requestReceipt.question }] : []),
		...(fields.requestReceipt?.response
			? [{ field: "request_receipt", key: "request_receipt.response", target: fields.requestReceipt.response }]
			: []),
		...(fields.attention?.flatMap((request, index) =>
			request.unblocks.map((target, targetIndex) => ({ field: "attention", key: `attention.${index}.unblocks.${targetIndex}`, target })),
		) ?? []),
		...(fields.relationships?.map((link, index) => ({ field: "relationships", key: `relationships.${index}.target`, target: link.target })) ?? []),
		...(fields.items?.map((target, index) => ({ field: "items", key: `items.${index}`, target })) ?? []),
		...(fields.evidence?.flatMap((item, index) =>
			item.criterion ? [{ field: "evidence", key: `evidence.${index}.criterion`, target: item.criterion }] : [],
		) ?? []),
	];
}
