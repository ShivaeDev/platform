import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerNotes, EXPLAIN_MESSAGE, noteless, notelessAnswerRemoved, notes, numberedAnswers, REJECTED_ELEMENT } from "#test/nestedRejections.ts";

notes.it("the server's rejection of an omitted note shows on the note", [], function* ({ feedbackOn, submit }) {
	expect(yield* feedbackOn("note")).toBeUndefined();

	yield* submit();

	expect(yield* feedbackOn("note")).toBe(EXPLAIN_MESSAGE);
});

answerNotes.it("the server's rejection of an answer's omitted note shows on that note", [], function* ({ answerError, submit }) {
	expect(yield* answerError(noteless.id, "note")).toBeUndefined();

	yield* submit();

	expect(yield* answerError(noteless.id, "note")).toBe(EXPLAIN_MESSAGE);
});

answerNotes.it(
	"removing the answer whose omitted note was rejected discards the rejection, so adding it back shows none",
	[answerNotes.submitted(), notelessAnswerRemoved()],
	function* ({ addAnswer, answerError }) {
		yield* addAnswer(noteless);

		expect(yield* answerError(noteless.id, "note")).toBeUndefined();
	},
);

numberedAnswers.it(
	"a whole answer's rejection moves with it when the answers are recreated in a new order",
	[numberedAnswers.submitted()],
	function* ({ answerError, moveAnswerToFront }) {
		expect(yield* answerError(1)).toBe(REJECTED_ELEMENT);

		yield* moveAnswerToFront(2);

		yield* outcomes({
			"answer One": [answerError(1), REJECTED_ELEMENT],
			"answer Two, now where answer One was": [answerError(2), undefined],
		});
	},
);

numberedAnswers.it(
	"editing inside the rejected answer discards its whole-answer rejection",
	[numberedAnswers.submitted()],
	function* ({ answerError, editAnswer }) {
		expect(yield* answerError(1)).toBe(REJECTED_ELEMENT);

		yield* editAnswer(1, { text: "Edited" });

		expect(yield* answerError(1)).toBeUndefined();
	},
);
