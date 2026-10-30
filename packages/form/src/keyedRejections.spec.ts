import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	CLOSED_MESSAGE,
	closed,
	closedAnswers,
	closedAnswerWasCorrected,
	closedAnswerWasRejected,
	closedAnswerWasRemoved,
} from "#test/arrayForms.ts";

closedAnswers.it(
	"the server's rejection of the closed answer shows on its text, on the answer and on the answers summary, but not on its id",
	[],
	function* ({ answerError, answersSummary, submit }) {
		expect(yield* answerError("closed", "text")).toBeUndefined();

		yield* submit();

		yield* outcomes({
			"answers summary": [answersSummary(), CLOSED_MESSAGE],
			"closed answer": [answerError("closed"), CLOSED_MESSAGE],
			"closed answer's id": [answerError("closed", "id"), undefined],
			"closed answer's text": [answerError("closed", "text"), CLOSED_MESSAGE],
		});
	},
);

closedAnswers.it(
	"the closed answer's rejection stays on it, not on an inserted answer with the same text",
	[closedAnswerWasRejected()],
	function* ({ answerError, insertAnswerBefore }) {
		expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);

		yield* insertAnswerBefore("first", { id: "inserted", text: closed.text });

		yield* outcomes({
			"closed answer's text": [answerError("closed", "text"), CLOSED_MESSAGE],
			"inserted answer's text": [answerError("inserted", "text"), undefined],
			"second answer's text, now where the closed answer was": [answerError("second", "text"), undefined],
		});
	},
);

closedAnswers.it(
	"the closed answer's rejection stays on it when the answer before it is removed",
	[closedAnswerWasRejected()],
	function* ({ answerError, removeAnswer }) {
		expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);

		yield* removeAnswer("second");

		expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);
	},
);

closedAnswers.it(
	"the closed answer's rejection stays on it, not on the answer now in its old place, when it moves to the front",
	[closedAnswerWasRejected()],
	function* ({ answerError, moveAnswerToFront }) {
		expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);

		yield* moveAnswerToFront("closed");

		yield* outcomes({
			"closed answer's text": [answerError("closed", "text"), CLOSED_MESSAGE],
			"second answer's text, now where the closed answer was": [answerError("second", "text"), undefined],
		});
	},
);

closedAnswers.it("editing another answer keeps the closed answer's rejection", [closedAnswerWasRejected()], function* ({ answerError, editAnswer }) {
	expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);

	yield* editAnswer("second", { text: "Edited sibling" });

	expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);
});

closedAnswers.it("leaving the answers keeps the closed answer's rejection", [closedAnswerWasRejected()], function* ({ answerError, leaveAnswers }) {
	expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);

	yield* leaveAnswers();

	expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);
});

closedAnswers.it("correcting the closed answer's text clears its rejection", [closedAnswerWasRejected()], function* ({ answerError, editAnswer }) {
	expect(yield* answerError("closed", "text")).toBe(CLOSED_MESSAGE);

	yield* editAnswer("closed", { text: "Corrected" });

	expect(yield* answerError("closed", "text")).toBeUndefined();
});

closedAnswers.it(
	"restoring the closed answer's rejected text does not bring its rejection back",
	[closedAnswerWasRejected(), closedAnswerWasCorrected()],
	function* ({ answerError, editAnswer }) {
		expect(yield* answerError("closed", "text")).toBeUndefined();

		yield* editAnswer("closed", { text: closed.text });

		expect(yield* answerError("closed", "text")).toBeUndefined();
	},
);

closedAnswers.it(
	"removing the closed answer discards its rejection, so adding it back shows none",
	[closedAnswerWasRejected(), closedAnswerWasRemoved()],
	function* ({ addAnswer, answerError }) {
		yield* addAnswer(closed);

		expect(yield* answerError("closed", "text")).toBeUndefined();
	},
);
