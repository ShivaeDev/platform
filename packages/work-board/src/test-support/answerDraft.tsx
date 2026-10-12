import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { AnswerForm } from "#client/react/AnswerForm.tsx";
import { shellIds } from "#client/react/shellIds.ts";

export const answerDocument: Document = {
	diagnostics: [],
	file: "question.md",
	links: {},
	metadata: {},
	modified: 0,
	questionActions: {},
	references: {},
	requests: [],
	source: "Choose a direction.",
	unavailable: [],
	writable: true,
};
export const answerPreview: QuestionPreview = {
	context: "Choose a direction.",
	id: "question.fixture",
	item: "item.fixture",
	reason: "Which?",
	request: "direction",
	reviewedRevision: "a".repeat(64),
	source: "question.md",
};
export function answerDraft(preview = answerPreview, update = 0, prompts: readonly Prompt[] = []) {
	return (
		<main id={shellIds.doc} key={update}>
			<AnswerForm document={answerDocument} preview={preview} request={{ id: preview.request, open: true, prompts }} />
		</main>
	);
}
export function answerInput(name: string, value?: string) {
	const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#response-form [name="${name}"]`);
	if (!input) {
		throw new Error(`Missing ${name}`);
	}
	if (value !== undefined) {
		input.value = value;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}
	return input;
}
export function responseClick(id: string) {
	const button = document.getElementById(`response-${id}`);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Missing ${id}`);
	}
	button.click();
}

export function answerPrompt(prompt: string, value?: string) {
	const input = document.querySelector<HTMLTextAreaElement>(`[data-prompt="${prompt}"] textarea`);
	if (!input) {
		throw new Error(`Missing ${prompt}`);
	}
	if (value !== undefined) {
		input.value = value;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}
	return input;
}
