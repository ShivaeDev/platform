import { responses } from "@shivaedev/work-board/server/integration/responses.ts";
import type { BoardDocument } from "#board/documents.ts";
import type { BoardDecision } from "#board/schema.ts";

export function reviewedDecision(receipt: BoardDecision, source: BoardDocument | undefined, documents: readonly BoardDocument[]): boolean {
	if (!source || source.file !== receipt.sourcePath || source.parsed.fields.id !== receipt.itemId) {
		return false;
	}
	const registered = documents.flatMap((document) => responses.questionFrom(document) ?? []).find((question) => question.id === receipt.questionId);
	return (
		registered !== undefined
		&& registered.question.request === receipt.request
		&& registered.question.reviewedRevision === receipt.revision
		&& responses.questionSourceMatches(registered, source)
	);
}
