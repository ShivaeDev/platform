import { Schema } from "effect";
import { expect } from "vitest";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveNotesStory, readScopeOfOnlyNoteOne, watching } from "#test/liveNotesStory.ts";
import { liveHints, watcher } from "#test/liveStreams.ts";

liveNotesStory.it(
	"with a read scope of only note 1, connecting re-reads note 1 and leaves note 2 unread",
	[readScopeOfOnlyNoteOne(), watching("note 1", "note 2")],
	function* ({ connect, timesRead }) {
		yield* outcomes({
			"note 1's reads": [timesRead("note 1"), "read once"],
			"note 2's reads": [timesRead("note 2"), "read once"],
		});

		yield* connect();

		yield* outcomes({
			"note 1's reads": [timesRead("note 1"), "read twice"],
			"note 2's reads": [timesRead("note 2"), "read once"],
		});
	},
);

const lines = collection("lines", Schema.Number);
const orders = collection("orders", Schema.Number);

for (const [change, keys, heard] of [
	["every order", ["orders:*"], ["changed orders 5"]],
	["every line", ["lines:*"], ["changed lines 5"]],
	["the lines list", invalidationKeys([lines.list]), ["changed the lines list"]],
] as const) {
	liveHints.it(
		`a change to ${change} reaches a watcher of line 5, the lines list and order 5 as ${heard.join(", ")}`,
		[watcher("the watcher", [lines.item(5), lines.list, orders.item(5)])],
		function* ({ heard: heardBy, invalidate }) {
			yield* invalidate(keys);

			expect(yield* heardBy("the watcher")).toEqual(heard);
		},
	);
}
