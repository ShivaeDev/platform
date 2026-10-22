import type { QuestionPreview } from "#browser/responses/schema.ts";
import { documentSource, type MetadataDocument, type MetadataModel } from "#server/metadata/model.ts";
import { currentQuestion } from "./currentQuestion.ts";
import { questionId, revisionOf } from "./records.ts";

export function questionPreview(document: MetadataDocument, request: string, reason: string, model: MetadataModel): QuestionPreview {
	const registered = currentQuestion(document, request, model);
	const context = registered?.context ?? documentSource(document);
	const reviewedRevision = registered?.question.reviewedRevision ?? revisionOf(context);
	const item = document.parsed.fields.id ?? "";
	return {
		context,
		id: registered?.id ?? questionId(item, request, reviewedRevision, document.file),
		item,
		reason,
		request,
		reviewedRevision,
		source: document.file,
	};
}
