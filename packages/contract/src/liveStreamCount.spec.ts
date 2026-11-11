import { expect } from "vitest";
import { notes } from "@shivaedev/test-kits/test-support/notes/model.ts";
import { liveHints, watcher } from "#test/liveStreams.ts";

liveHints.it(
	"with three streams open, closing one leaves a resync reporting two streams open",
	[watcher("the first watcher", [notes.item(1)]), watcher("the second watcher", [notes.item(2)]), watcher("the third watcher", [notes.list])],
	function* ({ close, resync }) {
		yield* close("the third watcher");

		expect(yield* resync()).toBe("2 streams open");
	},
);
