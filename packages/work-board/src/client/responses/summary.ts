import { promptHeading } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { PromptAnswer } from "#browser/responses/schema.ts";
import type { ResponseInput } from "./formSchema.ts";
export function responseSummary(values: ResponseInput, prompts: readonly Prompt[], answers: readonly PromptAnswer[] | undefined, attempted = true) {
	if (!attempted) {
		return "";
	}
	const missing =
		values.type === "answer"
			? prompts.filter((prompt) => {
					const answer = answers?.find((entry) => entry.prompt === prompt.id);
					return prompt.requireSelection ? !answer?.selected.length : !(answer?.text.trim() || answer?.selected.length);
				})
			: [];
	return missing.length > 0
		? `Unanswered: ${missing.map((prompt) => `“${promptHeading(prompt.source).title ?? `Question ${prompts.indexOf(prompt) + 1}`}”`).join(", ")}.`
		: "";
}

export function responseFeedback(status: string, outcome: string | undefined, summary: string) {
	return outcome || status.startsWith("Draft cleared") ? status : summary || status;
}
