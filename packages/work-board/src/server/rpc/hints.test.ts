import "#test/liveDeliveryBoundary.ts";
import { expect } from "vitest";
import { announcedChanges } from "#test/announcedChanges.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { interruptedDelivery } from "#test/interruptedDelivery.ts";

boardStory.it(
	"reconciles initially, targets contiguous edits and reconciles after server-local delivery loss",
	[projectFiles({ "note.md": "# Note", "other.md": "# Other" }), interruptedDelivery],
	function* ({ watchProject, editFile, loseNextChange, changeWasDropped, waitUntil }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		editFile("note.md", "# First edit");
		expect(yield* events.changed("note.md")).toMatchObject({ _tag: "Changed" });
		loseNextChange();
		editFile("note.md", "# Lost notification");
		yield* waitUntil(() => expect(changeWasDropped()).toBe(true));
		editFile("other.md", "# Next notification");
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
	},
);

boardStory.it(
	"sends no hint for a file event that changed neither bytes nor modification time",
	[projectFiles({ "note.md": "# Note", "other.md": "# Other" }), announcedChanges],
	function* ({ watchProject, editFile, replayFileEvent, changeWasAnnounced, waitUntil }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		replayFileEvent("note.md");
		yield* waitUntil(() => expect(changeWasAnnounced("note.md")).toBe(true));
		editFile("other.md", "# Other edited");
		const hint = yield* events.next();
		expect(hint).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "other.md" }]),
		});
		expect(JSON.stringify(hint)).not.toContain("note.md");
	},
);

boardStory.it(
	"refreshes a file saved again with the same bytes when its modification time changed",
	[projectFiles({ "note.md": "# Note" })],
	function* ({ watchProject, retouchFile }) {
		const events = yield* watchProject();
		expect(yield* events.next()).toEqual({ _tag: "Resync" });
		retouchFile("note.md");
		expect(yield* events.next()).toMatchObject({
			_tag: "Changed",
			keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "note.md" }]),
		});
	},
);
