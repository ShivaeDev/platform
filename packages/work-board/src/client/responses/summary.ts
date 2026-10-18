import { optionText, promptHeading } from "#browser/responses/cardContext.ts";
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
					return !(answer?.text.trim() || answer?.selected.length);
				})
			: [];
	return [
		values.author.trim() ? "" : "Add your local author label.",
		missing.length > 0
			? `Unanswered: ${missing.map((prompt) => `“${promptHeading(prompt.source).title ?? `Question ${prompts.indexOf(prompt) + 1}`}”`).join(", ")}.`
			: "",
	]
		.filter(Boolean)
		.join(" ");
}

export function responseFeedback(status: string, outcome: string | undefined, summary: string) {
	return outcome || status.startsWith("Draft cleared") ? status : summary || status;
}

export function chosenLabels(prompts: readonly Prompt[], answers: readonly PromptAnswer[] | undefined) {
	return prompts
		.flatMap((prompt) => {
			const selected = answers?.find((answer) => answer.prompt === prompt.id)?.selected ?? [];
			return prompt.options.filter((option) => selected.includes(option.id)).map((option) => optionText(option.id, option.source, "").label);
		})
		.join(", ");
}
