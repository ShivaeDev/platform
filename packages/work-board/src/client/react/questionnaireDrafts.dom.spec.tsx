import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answerPreview } from "#test/answerDraft.tsx";
import { screenStory } from "#test/screenStory.ts";
import { answerScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const prompts = [
	{ id: "direction", mode: "text" as const, options: [], source: "Which direction?" },
	{ id: "checks", mode: "text" as const, options: [], source: "Which checks?" },
];
const choices = [{ id: "direction", mode: "one" as const, options: [{ id: "local", source: "Keep local" }], source: "Which direction?" }];
const revised = { ...answerPreview, id: "question.revised", reviewedRevision: "b".repeat(64) };
const third = { ...answerPreview, id: "question.third", reviewedRevision: "c".repeat(64) };
const DIRECTION = "Direction in progress. ".repeat(300);
const CHECKS = "Checks in progress. ".repeat(300);

screenStory.it(
	"reopening a long questionnaire draft against a revised question again and again keeps the same answers, earlier answers and stored draft",
	[answerScreen(answerPreview, 0, prompts)],
	function* ({ questionnaireDraft, reopenAnswerCard, writeAnswer }) {
		yield* writeAnswer("Overall direction");
		yield* writeAnswer(DIRECTION, "direction");
		yield* writeAnswer(CHECKS, "checks");
		yield* reopenAnswerCard(revised, prompts);
		const first = yield* questionnaireDraft();
		expect(first).toEqual(
			expect.objectContaining({
				answers: { checks: CHECKS, direction: DIRECTION, "own words": "Overall direction" },
				earlier: expect.stringContaining(DIRECTION),
			}),
		);

		for (let reopening = 0; reopening < 4; reopening += 1) {
			yield* reopenAnswerCard(revised, prompts);
		}

		expect(yield* questionnaireDraft()).toEqual(first);
	},
);

screenStory.it(
	"an untouched questionnaire stores nothing and offers no earlier answers, even after its question is revised",
	[answerScreen(answerPreview, 0, prompts)],
	function* ({ answerCardRefreshes, questionnaireDraft }) {
		expect(yield* questionnaireDraft()).toEqual(expect.objectContaining({ earlier: "hidden", stored: "nothing stored" }));

		yield* answerCardRefreshes(revised, prompts, 1);

		expect(yield* questionnaireDraft()).toEqual(expect.objectContaining({ earlier: "hidden", stored: "nothing stored" }));
	},
);

screenStory.it(
	"answers changed after returning to an earlier version of the question replace that version's earlier answers instead of adding another entry",
	[answerScreen(answerPreview, 0, prompts)],
	function* ({ answerBoxState, answerCardRefreshes, previewAnswer, readDraftRecoveries, writeAnswer }) {
		yield* writeAnswer("First direction", "direction");
		yield* writeAnswer("First checks", "checks");
		yield* answerCardRefreshes(revised, prompts, 1);
		yield* previewAnswer();
		yield* answerCardRefreshes(third, prompts, 2);
		yield* answerCardRefreshes(answerPreview, prompts, 3);
		yield* previewAnswer();
		yield* writeAnswer("Revised direction", "direction");
		const before = yield* readDraftRecoveries();
		expect(before).toEqual([
			expect.stringContaining('"text": "First direction"'),
			expect.stringContaining(`Reviewed context: ${JSON.stringify([revised.id, revised.reviewedRevision])}`),
		]);

		yield* answerCardRefreshes(revised, prompts, 4);

		yield* outcomes([
			["direction", () => answerBoxState("direction"), expect.objectContaining({ text: "Revised direction" })],
			["earlier answers", () => readDraftRecoveries(), [expect.stringContaining('"text": "Revised direction"'), before[1]]],
		]);
	},
);

screenStory.it(
	"a stored draft whose earlier answers repeat the current answers is stored and shown as one entry, keeping older unrelated answers",
	[answerScreen(answerPreview, 0, prompts)],
	function* ({ answerBoxState, answerCardRefreshes, earlierAnswers, readDraftRecoveries, seedRepeatedRecovery, storedEarlierAnswers, writeAnswer }) {
		yield* writeAnswer("Existing direction", "direction");
		yield* writeAnswer("Existing checks", "checks");
		yield* answerCardRefreshes(revised, prompts, 1);
		yield* seedRepeatedRecovery(3, "Older unrelated answer");
		expect(yield* storedEarlierAnswers()).toEqual({
			legacy: expect.stringMatching(/(?:Existing direction.*){3}Older unrelated answer/su),
			versions: [],
		});

		yield* answerCardRefreshes(revised, prompts, 2);

		yield* outcomes([
			["direction", () => answerBoxState("direction"), expect.objectContaining({ text: "Existing direction" })],
			["earlier answers", () => earlierAnswers(), expect.stringContaining("Older unrelated answer")],
			["earlier entries", () => readDraftRecoveries(), [expect.stringContaining('"text": "Existing direction"')]],
			[
				"stored",
				() => storedEarlierAnswers(),
				{ legacy: "Older unrelated answer", versions: [expect.stringContaining('"text": "Existing direction"')] },
			],
		]);
	},
);

screenStory.it(
	"a choice made before the question was revised is cleared, and choosing it again keeps it and says the source changed",
	[answerScreen(answerPreview, 0, choices)],
	function* ({ answerCardRefreshes, answerStatusLine, chooseAnswer, chosenOptions }) {
		yield* chooseAnswer("local");
		yield* answerCardRefreshes(revised, choices, 0);
		expect(yield* chosenOptions()).toEqual([]);

		yield* chooseAnswer("local");

		yield* outcomes([
			["chosen", () => chosenOptions(), ["local"]],
			["status", () => answerStatusLine(), expect.stringContaining("Source changed")],
		]);
	},
);

screenStory.it(
	"a choice, note and backward selection made against the revised question survive a remount",
	[answerScreen(answerPreview, 0, choices)],
	function* ({ answerBoxState, answerCardRefreshes, chooseAnswer, chosenOptions, previewAnswer, selectInAnswer, writeAnswer }) {
		yield* answerCardRefreshes(revised, choices, 0);
		yield* chooseAnswer("local");
		yield* writeAnswer("A revised rationale", "direction");
		yield* previewAnswer();
		yield* selectInAnswer(3, 7, "direction");

		yield* answerCardRefreshes(revised, choices, 1);

		yield* outcomes([
			["chosen", () => chosenOptions(), ["local"]],
			["note", () => answerBoxState("direction"), { focused: true, selection: [3, 7], text: "A revised rationale" }],
		]);
	},
);
