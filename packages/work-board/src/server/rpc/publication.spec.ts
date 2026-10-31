import "#test/liveDeliveryBoundary.ts";
import { expect } from "vitest";
import { announcedChanges } from "#test/announcedChanges.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { interruptedDelivery } from "#test/interruptedDelivery.ts";
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
	"after the server's live delivery loses a change, a live client resyncs on the next change instead of trusting its gap",
	[...project, interruptedDelivery, liveClientSubscribed],
	function* ({ changeLost, changeNaming, editFile, loseNextChange, nextChange }) {
		editFile("note.md", "# First edit\n");
		expect(yield* changeNaming("note.md")).toEqual(["document note.md", "workspace index"]);

		loseNextChange();
		editFile("note.md", "# Lost edit\n");
		yield* changeLost();
		editFile("other.md", "# Next edit\n");

		expect(yield* nextChange()).toBe("resync");
	},
);

boardStory.it(
	"a file event that changes neither the bytes nor the modification time reaches no live client",
	[...project, announcedChanges, liveClientSubscribed],
	function* ({ editFile, nextChange, replayFileEvent, serverAnnounced }) {
		replayFileEvent("note.md");
		yield* serverAnnounced("note.md");
		editFile("other.md", "# Other edited\n");

		expect(yield* nextChange()).toEqual(["document other.md", "workspace index"]);
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
