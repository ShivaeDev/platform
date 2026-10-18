import "#test/liveDeliveryBoundary.ts";
import { expect } from "vitest";
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
