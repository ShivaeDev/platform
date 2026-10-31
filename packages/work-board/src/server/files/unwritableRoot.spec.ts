import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { liveClientSubscribed } from "#test/liveTraits.ts";
import { unwritableRoot } from "#test/unwritableRoot.ts";

boardStory.it(
	"a board that cannot write its root still watches it and delivers a live document edit to a connected client",
	[projectFiles({ "note.md": "# Before" }), unwritableRoot("EACCES"), liveClientSubscribed],
	function* ({ editFile, nextChange, sourceOf, watcherState }) {
		expect(yield* watcherState()).toBe("watching");

		editFile("note.md", "# After");

		yield* outcomes([
			["announced change", () => nextChange(), expect.arrayContaining(["document note.md"])],
			["the document", () => sourceOf("note.md"), "# After"],
		]);
	},
);
