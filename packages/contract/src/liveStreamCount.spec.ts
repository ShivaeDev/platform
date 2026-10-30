import { expect } from "vitest";
import { liveHints, watcher } from "#test/liveStreams.ts";
import { notes } from "#test/notes.ts";

liveHints.it(
	"with three streams open, closing one leaves a resync reporting two streams open",
	[watcher("the first watcher", [notes.item(1)]), watcher("the second watcher", [notes.item(2)]), watcher("the third watcher", [notes.list])],
	function* ({ close, resync }) {
		yield* close("the third watcher");

		expect(yield* resync()).toBe("2 streams open");
	},
);
