import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	BROKEN_NAME,
	checkAnswered,
	checkedNames,
	checksWaitForAnswers,
	nameChecked,
	namesNeedThreeCharacters,
	SHORT_NAME_MESSAGE,
	TAKEN_MESSAGE,
	TAKEN_NAME,
} from "#test/checks.ts";

checkedNames.it("changing a name its check called taken hides that message at once", [nameChecked(TAKEN_NAME)], function* ({ enter, feedbackOn }) {
	expect(yield* feedbackOn("name")).toBe(TAKEN_MESSAGE);

	yield* enter("name", "free");

	expect(yield* feedbackOn("name")).toBeUndefined();
});

checkedNames.it(
	"when the check of a new name fails, the earlier name's taken message does not come back",
	[nameChecked(TAKEN_NAME)],
	function* ({ checkedNamesSoFar, enterName, feedbackOn }) {
		expect(yield* feedbackOn("name")).toBe(TAKEN_MESSAGE);

		yield* enterName(BROKEN_NAME);

		yield* outcomes({
			"name feedback": [feedbackOn("name"), undefined],
			"names checked": [checkedNamesSoFar(), [TAKEN_NAME, BROKEN_NAME]],
		});
	},
);

checkedNames.it(
	"an older name's late answer does not show while the current name's check is pending",
	[checksWaitForAnswers(), nameChecked("old"), nameChecked("new")],
	function* ({ answerCheck, feedbackOn }) {
		expect(yield* feedbackOn("name")).toBeUndefined();

		yield* answerCheck("old", "Old is taken");

		expect(yield* feedbackOn("name")).toBeUndefined();
	},
);

checkedNames.it(
	"an older name's late answer does not replace the current name's answer",
	[checksWaitForAnswers(), nameChecked("old"), nameChecked("new"), checkAnswered("new", "New is taken")],
	function* ({ answerCheck, feedbackOn }) {
		expect(yield* feedbackOn("name")).toBe("New is taken");

		yield* answerCheck("old", "Old is taken");

		expect(yield* feedbackOn("name")).toBe("New is taken");
	},
);

checkedNames.it(
	"a name too short for its schema is never checked, and the first name long enough is",
	[namesNeedThreeCharacters(), checkedNames.edited("name", "ab")],
	function* ({ checkedNamesSoFar, enterName, feedbackOn }) {
		expect(yield* feedbackOn("name")).toBe(SHORT_NAME_MESSAGE);

		yield* enterName("abc");

		expect(yield* checkedNamesSoFar()).toEqual(["abc"]);
	},
);
