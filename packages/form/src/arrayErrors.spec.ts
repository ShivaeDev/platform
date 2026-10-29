import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { emptyAnswers, sameText, unkeyedAnswers } from "#test/arrayForms.ts";

emptyAnswers.it("submitting shows Required on the empty answer's text and on no other answer", [], function* ({ answerError, submit }) {
	expect(yield* answerError("empty", "text")).toBeUndefined();

	yield* submit();

	yield* outcomes({
		"empty answer's text": [answerError("empty", "text"), "Required"],
		"first answer's text": [answerError("first", "text"), undefined],
		"second answer's text": [answerError("second", "text"), undefined],
	});
});

emptyAnswers.it(
	"the empty answer's Required moves with it when an answer is inserted before the others",
	[emptyAnswers.submitted()],
	function* ({ answerError, insertAnswerBefore }) {
		expect(yield* answerError("empty", "text")).toBe("Required");

		yield* insertAnswerBefore("first", { id: "inserted", text: "New" });

		yield* outcomes({
			"empty answer's text": [answerError("empty", "text"), "Required"],
			"second answer's text, now where the empty answer was": [answerError("second", "text"), undefined],
		});
	},
);

emptyAnswers.it(
	"the empty answer's Required moves with it when the first answer is removed",
	[emptyAnswers.submitted()],
	function* ({ answerError, removeAnswer }) {
		expect(yield* answerError("empty", "text")).toBe("Required");

		yield* removeAnswer("first");

		yield* outcomes({
			"empty answer's text": [answerError("empty", "text"), "Required"],
			"second answer's text, now first": [answerError("second", "text"), undefined],
		});
	},
);

emptyAnswers.it("the empty answer's Required moves with it to the front", [emptyAnswers.submitted()], function* ({ answerError, moveAnswerToFront }) {
	expect(yield* answerError("empty", "text")).toBe("Required");

	yield* moveAnswerToFront("empty");

	yield* outcomes({
		"empty answer's text": [answerError("empty", "text"), "Required"],
		"second answer's text, now where the empty answer was": [answerError("second", "text"), undefined],
	});
});

unkeyedAnswers.it(
	"without array keys, a rejection stays at its position when an answer with the same text moves there",
	[unkeyedAnswers.submitted()],
	function* ({ answerErrorAt, moveAnswerToFront }) {
		expect(yield* answerErrorAt(0, "text")).toBe("Rejected");

		yield* moveAnswerToFront(sameText.id);

		yield* outcomes({
			"first position, now the same-text answer": [answerErrorAt(0, "text"), "Rejected"],
			"second position, now the first answer": [answerErrorAt(1, "text"), undefined],
		});
	},
);
