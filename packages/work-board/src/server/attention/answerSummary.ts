import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { AnswerSummary, RecordedResponse } from "#browser/responses/schema.ts";
import { documentSource, type MetadataDocument } from "#server/metadata/model.ts";
import { questionTemplate } from "#server/responses/template.ts";
import type { AttentionEntry } from "./requests.ts";

export function questionPrompts(source: string, request: string, file: string) {
	try {
		return questionTemplate(source, request, file).prompts;
	} catch {
		return [];
	}
}

export function requestPrompts(entry: AttentionEntry) {
	return questionPrompts(documentSource(entry.document), entry.request.id, entry.document.file);
}

export function responseSummary(
	answer: RecordedResponse,
	prompts: ReturnType<typeof questionPrompts>,
	document: MetadataDocument,
	maintainer: string,
): AnswerSummary {
	return {
		author: answer.response.author,
		choice: chosenLabels(prompts, answer.response.answers, document.parsed.fields.options),
		response: answer.id,
		yours: answer.response.author === maintainer,
	};
}

export function answerSummary(entry: AttentionEntry, maintainer = "maintainer"): AnswerSummary | undefined {
	return entry.answer && responseSummary(entry.answer, requestPrompts(entry), entry.document, maintainer);
}
