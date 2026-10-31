import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { TEXT_QUESTION_ID, textQuestionFixture } from "#test/answerCardFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const REASON = "Reconnecting to the Board. You can answer once it is back.";
const DRAFT = "Share one pool per worker.";
const question = routedScreen(textQuestionFixture, `/_board/item/${TEXT_QUESTION_ID}/`, { home: "home.md", writable: true });

screenStory.it(
	"a dropped live connection locks the answer card with a reason and keeps the draft",
	[question],
	function* ({ answerBoxState, answerCardLock, dropLiveConnection, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		expect(yield* answerCardLock()).toEqual({ answer: "open", notice: "none", record: "open" });

		yield* dropLiveConnection();

		yield* outcomes({
			card: [answerCardLock(), { answer: "locked", notice: REASON, record: "locked" }],
			draft: [answerBoxState(), expect.objectContaining({ text: DRAFT })],
		});
	},
);

screenStory.it(
	"the answer card unlocks with its draft once the live connection is back",
	[question],
	function* ({ answerBoxState, answerCardLock, dropLiveConnection, reconnectLive, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* dropLiveConnection();

		yield* reconnectLive();

		yield* outcomes({
			card: [answerCardLock(), { answer: "open", notice: "none", record: "open" }],
			draft: [answerBoxState(), expect.objectContaining({ text: DRAFT })],
		});
	},
);
