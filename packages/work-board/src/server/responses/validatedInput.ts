import { Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import { answerBody } from "#browser/responses/answerBody.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { DraftInput, PromptAnswer } from "#browser/responses/schema.ts";
import { questionTemplate } from "./template.ts";

function answerFor(prompt: Prompt, answer: PromptAnswer | undefined, required: boolean) {
	if (!answer || answer.prompt !== prompt.id) {
		throw new Conflict({ message: "Submit one answer per question, in template order." });
	}
	if (new Set(answer.selected).size !== answer.selected.length || (prompt.mode === "one" && answer.selected.length > 1)) {
		throw new Conflict({
			message:
				"The selected options do not match the question's selection mode. Select each option once and choose at most one for a single-choice question.",
		});
	}
	if (answer.selected.some((id) => !prompt.options.some((option) => option.id === id))) {
		throw new Conflict({ message: "A selected option is not in the reviewed template. Review the current options and select again." });
	}
	if (required && answer.selected.length === 0 && !answer.text.trim()) {
		throw new Conflict({ message: "Answer every question with a selection or additional text, or use Clarify / Not now." });
	}
}
export function validatedInput(input: DraftInput, context: string, request: string, file?: string): DraftInput {
	const template = questionTemplate(context, request, file);
	if (input.answers === undefined) {
		if (template.prompts.length > 0 && input.type === "answer") {
			throw new Conflict({ message: "This question packet requires answers for all prompts. Answer every prompt or use Clarify / Not now." });
		}
		if (!input.body.trim()) {
			throw new Conflict({ message: "A response needs text or answers to the question packet." });
		}
		return input;
	}
	if (input.answers.length !== template.prompts.length || template.prompts.length === 0) {
		throw new Conflict({ message: "The answer packet does not match the reviewed questions. Review the current packet and answer each prompt." });
	}
	template.prompts.forEach((prompt, index) => {
		answerFor(prompt, input.answers?.[index], input.type === "answer");
	});
	if (input.type !== "answer" && !input.body.trim() && !input.answers.some((answer) => answer.text.trim())) {
		throw new Conflict({ message: "Clarify / Not now needs explanatory text." });
	}
	const body = answerBody(template.prompts, input.answers, input.body);
	if (body.length > 32_768) {
		throw new Conflict({ message: "The complete recorded response exceeds 32768 characters. Shorten the response or split the source request." });
	}
	return { ...input, body };
}
