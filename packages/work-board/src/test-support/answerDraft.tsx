import { act } from "react";
import type { Document } from "#browser/document/schema.ts";
import type { Prompt } from "#browser/responses/Prompt.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import { AnswerForm } from "#client/react/AnswerForm.tsx";
import { shellIds } from "#client/react/shellIds.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";

export const ANSWER_SOURCE =
	"---\nid: item.fixture\nkind: task\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Choose a direction\n   unblocks: [item.fixture]\n---\n# Choose a direction\n";
export const answerFiles = { "question.md": ANSWER_SOURCE };

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
	context: ANSWER_SOURCE,
	id: questionId("item.fixture", "direction", revisionOf(ANSWER_SOURCE), "question.md"),
	item: "item.fixture",
	reason: "Which?",
	request: "direction",
	reviewedRevision: revisionOf(ANSWER_SOURCE),
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
		act(() => {
			input.value = value;
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	return input;
}
export function responseClick(id: string) {
	const button = document.getElementById(`response-${id}`);
	if (!(button instanceof HTMLButtonElement)) {
		throw new Error(`Missing ${id}`);
	}
	act(() => button.click());
}

export function answerPrompt(prompt: string, value?: string) {
	const input = document.querySelector<HTMLTextAreaElement>(`[data-prompt="${prompt}"] textarea`);
	if (!input) {
		throw new Error(`Missing ${prompt}`);
	}
	if (value !== undefined) {
		act(() => {
			input.value = value;
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	}
	return input;
}

export function answerContext(prompts: readonly Prompt[]) {
	const source =
		ANSWER_SOURCE
		+ prompts
			.map(
				(prompt) =>
					`\n::::question{id="${prompt.id}"${prompt.mode === "text" ? "" : ` select="${prompt.mode}"`}}\n${prompt.source}\n${prompt.options.map((option) => `:::option{id="${option.id}"}\n${option.source}\n:::\n`).join("\n")}::::\n`,
			)
			.join("\n");
	return {
		preview: {
			...answerPreview,
			context: source,
			id: questionId(answerPreview.item, answerPreview.request, revisionOf(source), answerPreview.source),
			reviewedRevision: revisionOf(source),
		},
		source,
	};
}
