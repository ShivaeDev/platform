import type { Prompt } from "#browser/responses/Prompt.ts";
import type { ResponseInput } from "./formSchema.ts";

export function initialResponse(prompts: readonly Prompt[], author: string, supersedes: string | undefined): ResponseInput {
	return {
		answerContext: undefined,
		answers: prompts.length > 0 ? prompts.map((prompt) => ({ prompt: prompt.id, selected: [], text: "" })) : undefined,
		author,
		body: "",
		id: "",
		question: "",
		recovery: undefined,
		revision: "",
		supersedes,
		type: "answer",
	};
}
