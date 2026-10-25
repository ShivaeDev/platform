import { Effect } from "effect";
import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import {
	STANDING_QUESTION_FILE,
	STANDING_QUESTION_ID,
	STANDING_QUESTION_REASON,
	STANDING_QUESTION_SOURCE,
	standingQuestionFixture,
} from "#test/standingQuestionFixture.ts";

boardStory.it(
	"moves a recorded standing decision answer from needs-you to waiting on the agent and asks again after an edit",
	[projectFiles(standingQuestionFixture()), responsesEnabled()],
	function* ({ answerStandingQuestion, editFile, readNeedsYou, readToday, register, savedAnswer }) {
		expect((yield* readToday()).you.map((row) => [row.id, row.reason])).toEqual([[STANDING_QUESTION_ID, STANDING_QUESTION_REASON]]);
		expect((yield* readNeedsYou()).you.map((row) => [row.id, row.reason])).toEqual([[STANDING_QUESTION_ID, STANDING_QUESTION_REASON]]);
		const saved = yield* answerStandingQuestion();
		expect(savedAnswer().fields.id).toBe(saved.id);
		expect(savedAnswer().fields.response).toMatchObject({
			answers: [{ prompt: "release-policy", selected: ["reviewed"], text: "Include the release notes." }],
			question: saved.response.question,
			type: "answer",
		});
		const today = yield* readToday();
		expect([today.you, (yield* readNeedsYou()).you]).toEqual([[], []]);
		expect(today.recent).toMatchObject([{ answer: { choice: "After review", response: saved.id, yours: true }, state: "waiting" }]);
		editFile(STANDING_QUESTION_FILE, STANDING_QUESTION_SOURCE.replace("When should releases ship?", "When should security releases ship?"));
		yield* Effect.promise(() =>
			waitFor(() => Effect.runPromise(readToday()).then((inbox) => expect(inbox.you.map((row) => row.id)).toEqual([STANDING_QUESTION_ID]))),
		);
		const revised = yield* register(STANDING_QUESTION_ID, "policy");
		expect(revised.question.reviewedRevision).not.toBe(saved.response.reviewedRevision);
		expect((yield* readToday()).you.map((row) => [row.id, row.reason])).toEqual([[STANDING_QUESTION_ID, STANDING_QUESTION_REASON]]);
		expect((yield* readNeedsYou()).you.map((row) => [row.id, row.reason])).toEqual([[STANDING_QUESTION_ID, STANDING_QUESTION_REASON]]);
		expect((yield* readToday()).recent).toMatchObject([{ state: "changed" }]);
	},
);
