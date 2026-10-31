import { expect } from "vitest";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { inboxQuestion } from "#test/inboxFixture.ts";

boardStory.it(
	"a question that recommends one of its options offers answer actions",
	[projectFiles({ "question.md": inboxQuestion }, "a question recommends one of its options"), responsesEnabled()],
	function* ({ answerActions }) {
		expect(yield* answerActions("question.md")).toEqual(["answer/answer", "/answer"]);
	},
);

boardStory.it(
	"a question that recommends an option it does not offer shows no answer actions",
	[
		projectFiles(
			{ "question.md": inboxQuestion.replace("recommended: Keep local files", "recommended: Missing") },
			"a question recommends an absent option",
		),
		responsesEnabled(),
	],
	function* ({ answerActions }) {
		expect(yield* answerActions("question.md")).toEqual([]);
	},
);
