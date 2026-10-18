import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { AnswerSummary } from "#browser/responses/schema.ts";
import { questionTemplate } from "#server/responses/template.ts";
import type { AttentionEntry } from "./requests.ts";

function prompts(entry: AttentionEntry) {
	try {
		return questionTemplate((entry.document.parsed.raw ?? "") + entry.document.parsed.body, entry.request.id, entry.document.file).prompts;
	} catch {
		return [];
	}
}

export function answerSummary(entry: AttentionEntry, maintainer = "maintainer"): AnswerSummary | undefined {
	const answer = entry.answer?.response;
	return (
		answer && {
			author: answer.author,
			choice: chosenLabels(prompts(entry), answer.answers, entry.document.parsed.fields.options),
			yours: answer.author === maintainer,
		}
	);
}
