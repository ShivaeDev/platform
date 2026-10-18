import { expect } from "vitest";
import { outcome } from "#server/responses/outcome.ts";
import { boardStory } from "#test/boardStory.ts";

boardStory.it("checks durable replies before a 48h deadline and never treats a missing next-response cursor as answered", [], () => {
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
