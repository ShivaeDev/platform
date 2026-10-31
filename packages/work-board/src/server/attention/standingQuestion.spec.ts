import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { standingPolicyAnswered } from "#test/attentionLaneTraits.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import {
	STANDING_QUESTION_FILE,
	STANDING_QUESTION_ID,
	STANDING_QUESTION_REASON,
	STANDING_QUESTION_SOURCE,
	standingQuestionFixture,
} from "#test/standingQuestionFixture.ts";

const standingPolicy = boardStory.traits(
	projectFiles(standingQuestionFixture(), "a standing release policy asks the maintainer"),
	responsesEnabled(),
);
const WAITING = [[STANDING_QUESTION_ID, STANDING_QUESTION_REASON]];

boardStory.it(
	"an unanswered standing decision waits on you in Today and in needs_you",
	[standingPolicy],
	function* ({ needsYouTool, todayNeedsYou }) {
		yield* outcomes({
			"needs_you tool": [needsYouTool(), WAITING],
			today: [todayNeedsYou(), WAITING],
		});
	},
);

boardStory.it(
	"answering the standing decision records the chosen option and note for its registered question",
	[standingPolicy],
	function* ({ answerStandingPolicy, savedAnswer }) {
		const saved = yield* answerStandingPolicy();

		expect(savedAnswer().fields).toMatchObject({
			id: saved.id,
			response: {
				answers: [{ prompt: "release-policy", selected: ["reviewed"], text: "Include the release notes." }],
				question: saved.response.question,
				type: "answer",
			},
		});
	},
);

boardStory.it(
	"answering the standing decision moves it from Needs you to recent answers waiting on the agent",
	[standingPolicy],
	function* ({ answerStandingPolicy, needsYouTool, recentAnswers, todayNeedsYou }) {
		expect(yield* todayNeedsYou()).toEqual(WAITING);

		const saved = yield* answerStandingPolicy();

		yield* outcomes({
			"needs_you tool": [needsYouTool(), []],
			recent: [
				recentAnswers(),
				[expect.objectContaining({ answer: expect.objectContaining({ choice: "After review", response: saved.id, yours: true }), state: "waiting" })],
			],
			today: [todayNeedsYou(), []],
		});
	},
);

boardStory.it(
	"editing the answered standing decision asks it again in Today and needs_you and marks the answer changed",
	[standingPolicy, standingPolicyAnswered],
	function* ({ edited, needsYouTool, recentAnswers, todayNeedsYou }) {
		expect(yield* recentAnswers()).toEqual([expect.objectContaining({ state: "waiting" })]);

		yield* edited(STANDING_QUESTION_FILE, STANDING_QUESTION_SOURCE.replace("When should releases ship?", "When should security releases ship?"));

		yield* outcomes({
			"needs_you tool": [needsYouTool(), WAITING],
			recent: [recentAnswers(), [expect.objectContaining({ state: "changed" })]],
			today: [todayNeedsYou(), WAITING],
		});
	},
);
