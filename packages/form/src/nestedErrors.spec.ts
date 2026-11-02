import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { profiles, twoUnanswered, UNANSWERED_MESSAGE } from "#test/nestedForms.ts";

twoUnanswered.it(
	"submitting two unanswered answers shows the message on each answer's text and on the answers summary, not on a selection",
	[],
	function* ({ answerSelectionError, answerTextError, feedbackOn, submit }) {
		expect(yield* answerTextError(0)).toBeUndefined();

		yield* submit();

		yield* outcomes([
			["answers summary", () => feedbackOn("answers"), UNANSWERED_MESSAGE],
			["first answer's selection", () => answerSelectionError(0), undefined],
			["first answer's text", () => answerTextError(0), UNANSWERED_MESSAGE],
			["second answer's text", () => answerTextError(1), UNANSWERED_MESSAGE],
		]);
	},
);

twoUnanswered.it(
	"choosing an option for the first answer clears its message and keeps the second's",
	[twoUnanswered.submitted()],
	function* ({ answerTextError, chooseOption }) {
		expect(yield* answerTextError(0)).toBe(UNANSWERED_MESSAGE);

		yield* chooseOption(0, "yes");

		yield* outcomes([
			["first answer's text", () => answerTextError(0), undefined],
			["second answer's text", () => answerTextError(1), UNANSWERED_MESSAGE],
		]);
	},
);

profiles.it(
	"leaving the profile shows Required on its empty name and on the profile, and nothing on its other field",
	[],
	function* ({ feedbackAt, leave }) {
		expect(yield* feedbackAt(["profile", "name"])).toBeUndefined();

		yield* leave("profile");

		yield* outcomes([
			["profile", () => feedbackAt(["profile"]), "Required"],
			["profile name", () => feedbackAt(["profile", "name"]), "Required"],
			["profile's other field", () => feedbackAt(["profile", "other"]), undefined],
		]);
	},
);
