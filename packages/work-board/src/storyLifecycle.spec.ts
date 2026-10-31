import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionBoardOpen, storyEngineStory } from "#test/storyEngineStory.ts";

const QUESTION = "Where should the project documents live?";

storyEngineStory.it(
	"when a board story fails, its server, folder and page close and the reader's last view stays readable",
	[questionBoardOpen()],
	function* ({ boardAnswers, failStory, pageBody, projectFolder, retainedView }) {
		const view = { inbox: ["1", "1"], text: expect.stringContaining(QUESTION) };
		yield* outcomes({
			board: [boardAnswers(), "answers"],
			folder: [projectFolder(), "present"],
			page: [pageBody(), expect.stringContaining(QUESTION)],
			view: [retainedView(), view],
		});

		yield* failStory();

		yield* outcomes({
			board: [boardAnswers(), "unreachable"],
			folder: [projectFolder(), "removed"],
			page: [pageBody(), "empty"],
			view: [retainedView(), view],
		});
	},
);
