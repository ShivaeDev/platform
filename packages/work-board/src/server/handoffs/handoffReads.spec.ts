import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { aKeyboardTask, HANDOFF_RECORD } from "#test/handoffTraits.ts";
import { recordedReads } from "#test/readTraits.ts";

boardStory.it(
	"preparing and listing a handoff reads only its task source and the record it wrote, not the other project notes",
	[
		projectFiles({ "notes/first.md": "# First\n", "notes/second.md": "# Second\n" }, "the project holds two unrelated notes"),
		aKeyboardTask(),
		recordedReads(),
	],
	function* ({ handoffHistory, noteReadsSoFar, prepareHandoff, readsSinceNoted, reviewHandoff }) {
		yield* reviewHandoff();
		expect(yield* noteReadsSoFar()).toEqual(expect.arrayContaining(["notes/first.md", "notes/second.md"]));

		yield* prepareHandoff();

		yield* outcomes({
			"files read": [readsSinceNoted(), [HANDOFF_RECORD, "items/keyboard.md"]],
			handoffs: [handoffHistory(), { records: ["handoff.keyboard.1 requested"], unreadable: [] }],
		});
	},
);
