import type { Prompt } from "./Prompt.ts";
import type { PromptAnswer } from "./schema.ts";

export function answerBody(prompts: readonly Prompt[], answers: readonly PromptAnswer[], note: string) {
	const sections = prompts.map((prompt, index) => {
		const answer = answers[index];
		const chosen = prompt.options.filter((option) => answer?.selected.includes(option.id));
		return `## Question: ${prompt.id}\n\n${prompt.source}\n\nSelected: ${chosen.map((option) => option.id).join(", ") || "No supplied option"}\n\n${chosen.map((option) => option.source).join("\n\n")}\n\n${answer?.text.trim() ? `Additional text:\n\n${answer.text}` : ""}`;
	});
	return `# Recorded response\n\n${sections.join("\n\n")}\n\n${note.trim() ? `## Overall response\n\n${note}` : ""}`.trim();
}
