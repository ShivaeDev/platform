import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerMoves } from "#test/answers.ts";
import { racingAnswers as answers, answersChanged, first, REJECTED_MESSAGE, second, secondMovedToFront } from "#test/arrayRaces.ts";

answers.it(
	"a rejection that arrives after the answers were reordered shows on the submitted answer in its new place",
	[answers.saveInFlight(), secondMovedToFront()],
	function* ({ answerError, finishSave }) {
		yield* finishSave();

		yield* outcomes({
			"first answer's text, now where the second answer was": [answerError("first", "text"), undefined],
			"second answer's text": [answerError("second", "text"), REJECTED_MESSAGE],
		});
	},
);

answers.it(
	"a rejection that arrives after its answer was edited shows nowhere",
	[answers.saveInFlight(), answersChanged("the second answer's text is edited", (current) => answerMoves.edit(current, second.id, { text: "New" }))],
	function* ({ answerError, answersSummary, finishSave }) {
		yield* finishSave();

		yield* outcomes({
			"answers summary": [answersSummary(), undefined],
			"first answer's text": [answerError("first", "text"), undefined],
			"second answer's text": [answerError("second", "text"), undefined],
		});
	},
);

answers.it(
	"a rejection that arrives after its answer was removed shows nowhere",
	[answers.saveInFlight(), answersChanged("the second answer is removed", (current) => answerMoves.remove(current, second.id))],
	function* ({ answerError, answersSummary, finishSave }) {
		yield* finishSave();

		yield* outcomes({
			"answers summary": [answersSummary(), undefined],
			"first answer's text": [answerError("first", "text"), undefined],
		});
	},
);

answers.it(
	"a rejection that arrives after its answer was replaced by another with the same text shows nowhere",
	[
		answers.saveInFlight(),
		answersChanged("the second answer is replaced by one with the same text", (current) =>
			answerMoves.replace(current, second.id, { id: "replacement", text: second.text }),
		),
	],
	function* ({ answerError, answersSummary, finishSave }) {
		yield* finishSave();

		yield* outcomes({
			"answers summary": [answersSummary(), undefined],
			"first answer's text": [answerError("first", "text"), undefined],
			"replacement answer's text": [answerError("replacement", "text"), undefined],
		});
	},
);

answers.it("a refresh that reorders the answers moves the rejection with its answer", [answers.submitted()], function* ({ answerError, refresh }) {
	expect(yield* answerError("second", "text")).toBe(REJECTED_MESSAGE);

	yield* refresh({ answers: [second, first] });

	yield* outcomes({
		"first answer's text, now where the second answer was": [answerError("first", "text"), undefined],
		"second answer's text": [answerError("second", "text"), REJECTED_MESSAGE],
	});
});

answers.it(
	"reverting to a refresh's order moves the rejection with its answer",
	[
		answers.submitted(),
		answers.refreshReceived({ answers: [second, first] }),
		answersChanged("the first answer moves back to the front", (current) => answerMoves.moveToFront(current, first.id)),
	],
	function* ({ answerError, revert }) {
		expect(yield* answerError("second", "text")).toBe(REJECTED_MESSAGE);

		yield* revert();

		yield* outcomes({
			"first answer's text, now where the second answer was": [answerError("first", "text"), undefined],
			"second answer's text, back at the front": [answerError("second", "text"), REJECTED_MESSAGE],
		});
	},
);

answers.it(
	"copying the rejected answer over the other discards the rejection rather than guess which copy it belongs to",
	[answers.submitted()],
	function* ({ answerError, answerErrorAt, replaceAnswer }) {
		expect(yield* answerError("second", "text")).toBe(REJECTED_MESSAGE);

		yield* replaceAnswer("first", second);

		yield* outcomes({
			"first position": [answerErrorAt(0, "text"), undefined],
			"second position": [answerErrorAt(1, "text"), undefined],
		});
	},
);
