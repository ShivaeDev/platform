import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { aTaskAwaitingDirection } from "#test/publicationTraits.ts";
import { recordedReads } from "#test/readTraits.ts";

boardStory.it(
	"saving an answer rereads only the asking source and its question record",
	[
		aTaskAwaitingDirection(),
		projectFiles({ "notes/first.md": "# First\n", "notes/second.md": "# Second\n" }, "two unrelated notes sit beside the task"),
		recordedReads(),
	],
	function* ({ answerFromBrowser, filesReadSinceAnswer }) {
		yield* answerFromBrowser("response.first", "Take the first direction.");

		expect(yield* filesReadSinceAnswer()).toEqual([expect.stringMatching(/^responses\/question\.[0-9a-f]{64}\.md$/u), "task.md"]);
	},
);

boardStory.it(
	"an answer saves in a workspace whose changes offer only a full refresh",
	[aTaskAwaitingDirection()],
	function* ({ answerThroughFullRefresh }) {
		expect(yield* answerThroughFullRefresh("response.second", "Take the second direction.")).toBe("response.second");
	},
);
