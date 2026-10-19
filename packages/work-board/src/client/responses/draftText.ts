import { chosenLabels } from "#browser/responses/cardContext.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { PromptAnswer } from "#browser/responses/schema.ts";
import type { Metadata } from "#metadata/schema.ts";

export function draftText(prompts: readonly Prompt[], answers: readonly PromptAnswer[] | undefined, body: string, options?: Metadata["options"]) {
	const chosen = chosenLabels(prompts, answers, options);
	return [chosen ? `Chose: ${chosen}` : "", ...(answers ?? []).map((answer) => answer.text.trim()), body.trim()].filter(Boolean).join("\n\n");
}
