import type { Document } from "#browser/document/schema.ts";

export function itemAsks(document: Document): Document["requests"] {
	const fields = document.metadata;
	return document.requests.filter(
		(request) => request.open || (request.id === "answer" && request.sourceOpen && fields.kind === "question" && fields.question === undefined),
	);
}

export function itemStatus(document: Document): string | undefined {
	const fields = document.metadata;
	if (!fields.id) {
		return undefined;
	}
	const asks = itemAsks(document);
	if (asks.length > 0) {
		return asks.some((request) => request.answered === undefined) ? "needs-you" : "waiting-on-agents";
	}
	if (fields.kind !== "decision" && fields.kind !== "question") {
		return fields.status;
	}
	return document.requestOutcome === "answered" ? "answered" : (fields.status ?? document.requestOutcome);
}
