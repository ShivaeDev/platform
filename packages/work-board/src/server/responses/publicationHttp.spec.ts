import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { DIRECTION_TASK } from "#test/publicationTraits.ts";

const reviewerTask = projectFiles({ "task.md": DIRECTION_TASK.replace("[maintainer]", "[reviewer]") }, "task.choice asks the reviewer for direction");

boardStory.it(
	"two boards recording one response identity with different text at once accept exactly one",
	[reviewerTask],
	function* ({ recordOnBoardsAtOnce, registerDirectionOn, responsesOn, startBoardNamed }) {
		yield* startBoardNamed("first");
		yield* startBoardNamed("second");
		const question = yield* registerDirectionOn("first");
		expect(yield* registerDirectionOn("second")).toEqual(question);

		const recorded = yield* recordOnBoardsAtOnce(question.id, { first: "First direction", second: "Other direction" });

		expect(recorded).toEqual(["conflict: This identity already records different content; no file was replaced.", "recorded"]);
		expect(yield* responsesOn("second", question.id)).toEqual([expect.stringMatching(/^(?:First|Other) direction$/u)]);
	},
);

boardStory.it(
	"a board started after the others stopped returns the recorded response for an identical retry and leaves its file untouched",
	[reviewerTask],
	function* ({ fileText, recordOn, registerDirectionOn, startBoardNamed, stopNamedBoards }) {
		yield* startBoardNamed("first");
		const question = yield* registerDirectionOn("first");
		const recorded = yield* recordOn("first", question.id, "First direction");
		const file = yield* fileText("responses/response.concurrent.md");
		yield* stopNamedBoards();
		yield* startBoardNamed("restarted");

		const retried = yield* recordOn("restarted", question.id, "First direction");

		expect(retried).toEqual(recorded);
		expect(yield* fileText("responses/response.concurrent.md")).toBe(file);
	},
);

boardStory.it(
	"a board started after the others stopped returns the registered question for the same reviewed revision",
	[reviewerTask],
	function* ({ registerDirectionOn, startBoardNamed, stopNamedBoards }) {
		yield* startBoardNamed("first");
		const question = yield* registerDirectionOn("first");
		yield* stopNamedBoards();
		yield* startBoardNamed("restarted");

		expect(yield* registerDirectionOn("restarted")).toEqual(question);
	},
);
