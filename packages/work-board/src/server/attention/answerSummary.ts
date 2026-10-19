import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { AnswerSummary } from "#browser/responses/schema.ts";
import { documentSource } from "#server/metadata/model.ts";
import { questionTemplate } from "#server/responses/template.ts";
import type { AttentionEntry } from "./requests.ts";

export function requestPrompts(entry: AttentionEntry) {
	try {
		return questionTemplate(documentSource(entry.document), entry.request.id, entry.document.file).prompts;
	} catch {
		return [];
	}
}

export function answerSummary(entry: AttentionEntry, maintainer = "maintainer"): AnswerSummary | undefined {
	const answer = entry.answer;
	return (
		answer && {
			author: answer.response.author,
			choice: chosenLabels(requestPrompts(entry), answer.response.answers, entry.document.parsed.fields.options),
			response: answer.id,
			yours: answer.response.author === maintainer,
		}
	);
}
