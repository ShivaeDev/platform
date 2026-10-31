import { expect } from "vitest";
import {
	answers,
	answersShown,
	thirdClosedByServer,
	thirdFilledAndMovedFirst,
	thirdRequired,
	thirdRequiredAfterFirstRemoved,
} from "#test/answerStories.ts";

answers.it("saving with an empty answer shows Required on that answer", [answersShown()], function* ({ messages, save }) {
	expect(yield* messages()).toEqual(["first", "second", "third"]);

	yield* save();

	expect(yield* messages()).toEqual(["first", "second", "third: Required"]);
});

answers.it("removing another answer keeps Required on its answer", [thirdRequired()], function* ({ messages, remove }) {
	yield* remove("first");

	expect(yield* messages()).toEqual(["second", "third: Required"]);
});

answers.it("moving a required answer to the top moves its Required with it", [thirdRequiredAfterFirstRemoved()], function* ({ messages, moveFirst }) {
	expect(yield* messages()).toEqual(["second", "third: Required"]);

	yield* moveFirst("third");

	expect(yield* messages()).toEqual(["third: Required", "second"]);
});

answers.it("the server's rejection shows on the answer it names after a reorder", [thirdFilledAndMovedFirst()], function* ({ messages, save }) {
	yield* save();

	expect(yield* messages()).toEqual(["third: Answer is closed", "first", "second"]);
});

const edits = [
	["stays with its answer when it moves to the top", "moveFirst", "third", ["third: Answer is closed", "first", "second"]],
	["stays with its answer when another answer moves above it", "moveFirst", "second", ["second", "first", "third: Answer is closed"]],
	["stays with its answer when another answer is removed", "remove", "first", ["second", "third: Answer is closed"]],
	["leaves with its answer when that answer is removed", "remove", "third", ["first", "second"]],
] as const;

for (const [claim, verb, id, expected] of edits) {
	answers.it(`the server's rejection ${claim}`, [thirdClosedByServer()], function* (story) {
		expect(yield* story.messages()).toEqual(["first", "second", "third: Answer is closed"]);

		yield* story[verb](id);

		expect(yield* story.messages()).toEqual(expected);
	});
}
