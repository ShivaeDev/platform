import { expect } from "vitest";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { liveHints, watcher } from "#test/liveStreams.ts";
import { notes } from "#test/notes.ts";

liveHints.it(
	"a change to note 1 reaches the note 1 watcher and not the note 2 watcher",
	[watcher("the note 1 watcher", [notes.item(1)]), watcher("the note 2 watcher", [notes.item(2)])],
	function* ({ heard, invalidate }) {
		yield* invalidate(invalidationKeys([notes.item(1)]));

		yield* outcomes({
			"the note 1 watcher": [heard("the note 1 watcher"), ["changed notes 1"]],
			"the note 2 watcher": [heard("the note 2 watcher"), []],
		});
	},
);

liveHints.it(
	"a resync reaches every watcher of its server and reports their two streams open",
	[watcher("the note 1 watcher", [notes.item(1)]), watcher("the note 2 watcher", [notes.item(2)])],
	function* ({ nextHint, resync }) {
		expect(yield* resync()).toBe("2 streams open");

		yield* outcomes({
			"the note 1 watcher": [nextHint("the note 1 watcher"), "resync"],
			"the note 2 watcher": [nextHint("the note 2 watcher"), "resync"],
		});
	},
);

liveHints.it(
	"a resync from the first server does not reach the watcher of a second server sharing its Reactivity",
	[watcher("the first watcher", [notes.item(1)]), watcher("the second watcher", [notes.item(1)], "the second server")],
	function* ({ heard, nextHint, resync }) {
		yield* resync("the first server");

		yield* outcomes({
			"the first watcher": [nextHint("the first watcher"), "resync"],
			"the second watcher": [heard("the second watcher"), []],
		});
	},
);

liveHints.it(
	"a change to notes 1 and 3 reaches a watcher of notes 1 and 2 naming only note 1",
	[watcher("the watcher", [notes.item(1), notes.item(2)])],
	function* ({ heard, invalidate }) {
		yield* invalidate(invalidationKeys([notes.item(1), notes.item(3)]));

		expect(yield* heard("the watcher")).toEqual(["changed notes 1"]);
	},
);
