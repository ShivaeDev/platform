import { expect, it } from "vitest";
import { outcome } from "#responses/outcome.ts";
import { DRAFT_AGE, DRAFT_BYTES, encodeDrafts, readDrafts } from "./drafts.ts";

const draft = {
	author: "maintainer",
	body: "No; preserve the rationale.",
	id: "response.a",
	revision: "a".repeat(64),
	type: "answer",
	updatedAt: 100,
};
it("expires browser drafts from the last edit and rejects malformed or oversized storage without pretending it is empty", () => {
	expect(readDrafts(encodeDrafts({ q: draft }), 101).drafts.q).toEqual(draft);
	expect(readDrafts(encodeDrafts({ q: draft }), 100 + DRAFT_AGE)).toEqual({ drafts: {}, expired: true });
	expect(() => readDrafts("broken", 101)).toThrow();
	expect(() => readDrafts('{"q":{}}', 101)).toThrow();
	expect(() => readDrafts(JSON.stringify({ q: { ...draft, type: "approve" } }), 101)).toThrow();
	expect(() => encodeDrafts({ q: { ...draft, body: "💬".repeat(DRAFT_BYTES) } })).toThrow("full");
});
it("checks durable replies before a 48h deadline and never treats a missing next-response cursor as answered", () => {
	const question = {
		context: "# Context",
		id: "question.a",
		question: {
			deadline: 48 * 60 * 60 * 1000,
			item: "item.a",
			reason: "Which?",
			registeredAt: 0,
			request: "review",
			reviewedRevision: "a".repeat(64),
			source: "item.md",
		},
	};
	const response = {
		body: "Not now",
		id: "response.a",
		response: {
			author: "maintainer",
			question: question.id,
			recordedAt: question.question.deadline + 1,
			reviewedRevision: question.question.reviewedRevision,
			type: "not_now" as const,
		},
	};
	expect(outcome({ question, responses: [] }, undefined, question.question.deadline - 1).kind).toBe("pending");
	expect(outcome({ question, responses: [] }, undefined, question.question.deadline).kind).toBe("unanswered");
	expect(outcome({ question, responses: [response] }, undefined, question.question.deadline + 2)).toMatchObject({ kind: "response", response });
	expect(outcome({ question, responses: [response] }, "response.unknown", 0).kind).toBe("missing_cursor");
});
