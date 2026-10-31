import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionOptionMarkdown } from "#test/questionOptionMarkdown.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const QUESTION = routedScreen({ "question.md": questionOptionMarkdown(), "task.md": "# Affected work" }, "/_board/item/question.reading/", {
	home: undefined,
	writable: true,
});

screenStory.it(
	"a question's prompt and option bodies show their Markdown as bold text, code, links and lists, with no Markdown marks left",
	[QUESTION],
	function* ({ questionReading }) {
		yield* outcomes({
			option: [
				questionReading("display", "history"),
				expect.objectContaining({
					code: ["responses"],
					links: ["affected work -> /task.md"],
					list: ["Preserve the reasoning.", "Show previous replies."],
					markdownLeft: false,
				}),
			],
			prompt: [
				questionReading("display"),
				expect.objectContaining({
					code: ["responses"],
					emphasis: ["replies", "context"],
					links: ["affected work -> /task.md"],
					list: ["Read the proposal.", "Choose a direction."],
					markdownLeft: false,
				}),
			],
		});
	},
);

screenStory.it(
	"choosing a Markdown option with a note records that option and the note",
	[QUESTION],
	function* ({ chooseAnswer, recordAnswer, recordedAnswers, writeAnswer }) {
		yield* chooseAnswer("history");
		yield* writeAnswer("Keep the reasoning visible.", "display");

		yield* recordAnswer();

		expect(yield* recordedAnswers("question.reading", "answer")).toEqual([
			expect.objectContaining({ answers: [{ prompt: "display", selected: ["history"], text: "Keep the reasoning visible." }] }),
		]);
	},
);
