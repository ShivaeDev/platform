import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, readerAt, responsesEnabled } from "#test/boardStory.ts";
import { pageAnswerFormReady } from "#test/pageAnswerFormReady.ts";
import { anOpenQuestion, aRememberedAuthor } from "#test/storyTraits.ts";

const questionPage = [
	anOpenQuestion(),
	responsesEnabled(),
	readerAt("/_board/item/question.storage/"),
	pageAnswerFormReady(),
	aRememberedAuthor("Casey"),
];

boardStory.it(
	"sending the recommended option from the item page records it with the remembered author",
	questionPage,
	function* ({ pageAnswerStatus, pageChooses, recordedPageAnswer, sendPageAnswer }) {
		yield* pageChooses("option-1");

		yield* sendPageAnswer();

		yield* outcomes([
			[
				"recorded answer",
				() => recordedPageAnswer(),
				{ author: "Casey", body: expect.stringContaining("Keep local files"), kind: undefined, selected: [["option-1"]] },
			],
			["status", () => pageAnswerStatus(), expect.stringContaining("Answer saved")],
		]);
	},
);

boardStory.it(
	"an answer sent from the item page clears the question from the live Inbox badges",
	questionPage,
	function* ({ inboxBadgeUpdates, pageChooses, pageInboxBadges, sendPageAnswer }) {
		yield* pageChooses("option-1");
		expect(yield* pageInboxBadges()).toEqual(["1", "1"]);

		yield* sendPageAnswer();
		yield* inboxBadgeUpdates();

		expect(yield* pageInboxBadges()).toEqual(["0", "0"]);
	},
);
