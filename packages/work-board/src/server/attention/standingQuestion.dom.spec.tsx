import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { STANDING_QUESTION_ID, standingQuestionFixture } from "#test/standingQuestionFixture.ts";

expectNoReactWarnings();

const standingQuestion = routedScreen(standingQuestionFixture(), `/_board/item/${STANDING_QUESTION_ID}/`, { home: "home.md", writable: true });

screenStory.it(
	"answering the standing question shows the chosen option and the note on the item",
	[standingQuestion],
	function* ({ answerPrompt, check, responsePanel, sendPacket }) {
		yield* check("reviewed");
		yield* answerPrompt("release-policy", "Include the release notes.");

		yield* sendPacket();

		expect(yield* responsePanel()).toEqual(expect.stringMatching(/Chose After review.*Include the release notes\./su));
	},
);

screenStory.it(
	"answering the standing question moves it on Today from Needs you to Answered, waiting on the agent",
	[standingQuestion],
	function* ({ answerPrompt, answeredOnToday, check, navigate, needsYouItems, needsYouSection, sendPacket }) {
		yield* navigate("/");
		yield* outcomes([
			["answered", () => answeredOnToday(STANDING_QUESTION_ID), "not listed"],
			["needs you", () => needsYouItems(), [STANDING_QUESTION_ID]],
		]);
		yield* navigate(`/_board/item/${STANDING_QUESTION_ID}/`);
		yield* check("reviewed");
		yield* answerPrompt("release-policy", "Include the release notes.");

		yield* sendPacket();

		yield* navigate("/");
		yield* outcomes([
			["answered", () => answeredOnToday(STANDING_QUESTION_ID), "When should releases ship? · You chose After review · Waiting on the agent."],
			["needs you", () => needsYouItems(), []],
			["section", () => needsYouSection(), expect.stringContaining("Nothing needs you")],
		]);
	},
);
