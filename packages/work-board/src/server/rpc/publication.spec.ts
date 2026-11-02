import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { liveClientSubscribed } from "#test/liveTraits.ts";

const project = [projectFiles({ "home.md": "# Home\n", "note.md": "# Note\n", "other.md": "# Other\n" }), boardHome("home.md")];

boardStory.it(
	"a client that subscribes to a watched project opens with a resync",
	[...project, liveClientSubscribed],
	function* ({ clientSubscribes, nextChange }) {
		yield* clientSubscribes("a second client");

		expect(yield* nextChange("a second client")).toBe("resync");
	},
);

boardStory.it(
	"a file saved again with the same bytes and a later modification time reaches a live client as a change to its document",
	[...project, liveClientSubscribed],
	function* ({ nextChange, retouchFile }) {
		retouchFile("note.md");

		expect(yield* nextChange()).toEqual(["document note.md", "workspace index"]);
	},
);
