import { type MetadataDocument, metadataModel } from "#server/metadata/model.ts";
import { decisionClosed } from "#server/migration/decisionClosed.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";
import { responseIndex } from "#server/responseIndex.ts";
import { revisionOf } from "#server/responses/records.ts";

export function decisionAnswers(files: readonly { readonly file: string; readonly source: string }[], documents: readonly MetadataDocument[]) {
	const index = responseIndex(metadataModel(documents));
	const answers = new Set<string>();
	for (const { file, source } of files) {
		const header = sourceHeader(source);
		const id = header?.doc.get("id");
		if (header?.doc.get("kind") !== "decision" || typeof id !== "string") {
			continue;
		}
		const closed = decisionClosed(header);
		const records = index
			.questionsFor(id)
			.filter((question) => question.question.source === file && (closed || question.question.reviewedRevision === revisionOf(source)))
			.flatMap((question) => index.responsesFor(question).current.filter((record) => record.response.type === "answer"));
		if (records.length > 0) {
			answers.add(id);
		}
	}
	return answers;
}
