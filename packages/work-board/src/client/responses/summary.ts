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
		missing.length > 0 ? `Unanswered prompts: ${missing.map((prompt) => `Question ${prompts.indexOf(prompt) + 1} · ${prompt.id}`).join("; ")}.` : "",
	]
		.filter(Boolean)
		.join(" ");
}

export function responseReadiness(valid: boolean, previewed: boolean, attempted = true) {
	if (!(attempted || valid)) {
		return "Preview the Markdown before recording your answer.";
	}
	if (!valid) {
		return "This draft is invalid. Review the response fields before recording.";
	}
	return previewed ? "Preview ready. Record this response when you are ready." : "Draft ready. Preview the Markdown before recording it.";
}

export function responseFeedback(status: string, outcome: string | undefined, summary: string, readiness: string) {
	return outcome || status.startsWith("Draft cleared") ? status : summary || readiness;
}
