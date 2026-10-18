import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";

boardStory.it(
	"omits response actions for an invalid template without turning it into a reading defect",
	[
		projectFiles(
			{ "question.md": inboxQuestion.replace("recommended: Keep local files", "recommended: Missing") },
			"a question recommends an absent option",
		),
		responsesEnabled(),
	],
	function* ({ readQuestionActions }) {
		expect(yield* readQuestionActions("question.md")).toEqual(new Map());
	},
);
