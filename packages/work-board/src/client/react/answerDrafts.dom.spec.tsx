import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerPreview } from "#test/answerDraft.tsx";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const DRAFT = "Direction in progress";
const LIVE_UPDATE = { ...answerPreview, context: "Fresh live context" };
const REVISED = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
const OTHER_REQUEST = { ...answerPreview, id: "question.other", request: "other" };
const PROMPT = [{ id: "direction", mode: "text" as const, options: [], source: "Which direction?" }];

screenStory.it(
	"an unsent answer comes back when the page opens again in a fresh React tree",
	[answerScreen()],
	function* ({ answerBoxState, reopenAnswerCard, writeAnswer }) {
		yield* writeAnswer(DRAFT);

		yield* reopenAnswerCard();

		expect((yield* answerBoxState()).text).toBe(DRAFT);
	},
);

screenStory.it(
	"an unsent answer stays when a live update remounts the card for the same request",
	[answerScreen()],
	function* ({ answerBoxState, answerCardRefreshes, writeAnswer }) {
		yield* writeAnswer(DRAFT);

		yield* answerCardRefreshes(LIVE_UPDATE, [], 1);

		expect((yield* answerBoxState()).text).toBe(DRAFT);
	},
);

screenStory.it(
	"when the question's source changes, the card keeps the answer, says the source changed and still lets the reader record",
	[answerScreen()],
	function* ({ answerBoxState, answerCardRefreshes, answerStatusLine, recordButton, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		expect(yield* answerStatusLine()).toBe("");

		yield* answerCardRefreshes(REVISED);

		yield* outcomes([
			["answer", () => answerBoxState(), expect.objectContaining({ text: DRAFT })],
			["Record answer", () => recordButton(), "enabled"],
			["status", () => answerStatusLine(), expect.stringContaining("Source changed since this draft.")],
		]);
	},
);

screenStory.it(
	"a preview taken after the source changed binds the answer to the new revision",
	[answerScreen()],
	function* ({ answerCardRefreshes, answerPreviewText, previewAnswer, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* answerCardRefreshes(REVISED);

		yield* previewAnswer();

		expect(yield* answerPreviewText()).toContain("b".repeat(64));
	},
);

screenStory.it(
	"recording an answer saves it and empties both the answer box and the browser's stored draft",
	[answerScreen()],
	function* ({ answerBoxState, recordAnswer, recordedAnswers, storedDraft, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		expect(yield* storedDraft("item.fixture", "direction")).toContain(DRAFT);

		yield* recordAnswer();

		yield* outcomes([
			["answer box", () => answerBoxState(), expect.objectContaining({ text: "" })],
			["recorded", () => recordedAnswers("item.fixture", "direction"), [expect.objectContaining({ body: DRAFT })]],
			["stored draft", () => storedDraft("item.fixture", "direction"), "nothing stored"],
		]);
	},
);

screenStory.it(
	"the card mounted after an answer is recorded starts empty",
	[answerScreen()],
	function* ({ answerBoxState, answerCardRefreshes, recordAnswer, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* recordAnswer();

		yield* answerCardRefreshes(answerPreview, [], 1);

		expect((yield* answerBoxState()).text).toBe("");
	},
);

screenStory.it(
	"Clear draft empties only the current request's draft and says saved responses are unchanged",
	[answerScreen()],
	function* ({ answerBoxState, answerCardRefreshes, answerStatusLine, clearAnswerDraft, storedDraft, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* answerCardRefreshes(OTHER_REQUEST, [], 1);
		yield* writeAnswer("Other direction");

		yield* clearAnswerDraft();

		yield* outcomes([
			["answer box", () => answerBoxState(), expect.objectContaining({ text: "" })],
			["first request's draft", () => storedDraft("item.fixture", "direction"), expect.stringContaining(DRAFT)],
			["other request's draft", () => storedDraft("item.fixture", "other"), "nothing stored"],
			["status", () => answerStatusLine(), "Draft cleared. Saved responses are unchanged."],
		]);
	},
);

screenStory.it(
	"the answer box keeps its text, focus and selection when the refreshed question gains a prompt",
	[answerScreen()],
	function* ({ answerBoxState, answerCardRefreshes, selectInAnswer, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* selectInAnswer(4, 9);

		yield* answerCardRefreshes(REVISED, PROMPT);

		expect(yield* answerBoxState()).toEqual({ focused: true, selection: [4, 9], text: DRAFT });
	},
);

screenStory.it(
	"the answer box keeps its text, focus and selection when the refreshed question loses its prompt",
	[answerScreen(REVISED, 0, PROMPT)],
	function* ({ answerBoxState, answerCardRefreshes, selectInAnswer, writeAnswer }) {
		yield* writeAnswer(DRAFT);
		yield* selectInAnswer(3, 7);

		yield* answerCardRefreshes(answerPreview);

		expect(yield* answerBoxState()).toEqual({ focused: true, selection: [3, 7], text: DRAFT });
	},
);
