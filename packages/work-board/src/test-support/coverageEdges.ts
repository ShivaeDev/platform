import type { Draft } from "#browser/responses/drafts.ts";

export const edgeDraft: Draft = {
	author: "reviewer",
	body: "Keep the reasoning.",
	id: "response.edge",
	revision: "a".repeat(64),
	type: "answer",
	updatedAt: 100,
};

export const TEXT_QUESTION = '::::question{id="next" select="text"}\nWhat should happen next?\n::::\n';

export const responseInput = {
	author: "reviewer",
	body: "",
	id: "response.edge",
	question: "question.edge",
	type: "answer" as const,
};

export function packetOption(body: string) {
	return `::::question{id="next"}\nChoose the next step.\n\n:::option{id="review"}\n${body}\n:::\n::::\n`;
}

export const EDGE_ATTENTION_SOURCE =
	"---\nid: item.edge\nkind: task\nnext_action: Review the context\nattention:\n  - id: direction\n    kind: review\n    state: open\n    reason: Which direction?\n    response_from: [reviewer]\n    unblocks: [item.edge]\n---\n# Reviewed item\n\nOriginal context.\n";

export const DUPLICATE_CRITERION_SOURCE =
	"---\nid: item.edge\ncriteria:\n  - id: duplicate\n    text: First criterion\n  - id: duplicate\n    text: Second criterion\n---\n# Item\n";
