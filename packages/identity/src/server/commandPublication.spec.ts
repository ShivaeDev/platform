import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notes } from "#test/command-changes/fixture.ts";
import { broadcastFails, commandChanges, publicationFails } from "#test/command-changes/story.ts";

commandChanges.it(
	"declared keys use the final command result and reach both hosts after the handler commits",
	[],
	function* ({ initialHint, nextHint, publicationSaw, save }) {
		yield* outcomes({
			"initial local hint": [initialHint("local"), { _tag: "Resync" }],
			"initial remote hint": [initialHint("remote"), { _tag: "Resync" }],
		});

		const saved = yield* save("Ada's note");

		expect(saved).toEqual({ id: 1, title: "Ada's note" });
		yield* outcomes({
			"committed notes visible during publication": [publicationSaw(), [[{ title: "Ada's note" }]]],
			"local hint": [nextHint("local"), { _tag: "Changed", keys: [notes.item(1)] }],
			"remote hint": [nextHint("remote"), { _tag: "Changed", keys: [notes.item(1)] }],
		});
	},
);

commandChanges.it(
	"a failed Resync broadcast still resyncs local streams, preserves the saved note and logs the remote delivery gap",
	[publicationFails("always"), broadcastFails],
	function* ({ errorMessages, nextHint, read, save }) {
		yield* save("Ada's note");

		yield* outcomes({
			"local hint": [nextHint("local"), { _tag: "Resync" }],
			"publication and broadcast errors": [
				errorMessages(),
				[
					"Committed command invalidation failed; resynchronizing live streams",
					"Committed command Resync broadcast failed; other hosts may remain stale",
				],
			],
			"saved notes": [read(), [{ id: 1, title: "Ada's note" }]],
		});
	},
);

commandChanges.it(
	"two failed publications retry without repeating the write and still deliver changed keys to both hosts",
	[publicationFails(2)],
	function* ({ nextHint, publicationSaw, read, save }) {
		yield* save("Ada's note");

		yield* outcomes({
			"committed notes visible on each attempt": [publicationSaw(), Array.from({ length: 3 }, () => [{ title: "Ada's note" }])],
			"local hint": [nextHint("local"), { _tag: "Changed", keys: [notes.item(1)] }],
			"remote hint": [nextHint("remote"), { _tag: "Changed", keys: [notes.item(1)] }],
			"saved notes": [read(), [{ id: 1, title: "Ada's note" }]],
		});
	},
);

commandChanges.it(
	"exhausted publication retries preserve the committed command result and resync live streams on both hosts",
	[publicationFails("always")],
	function* ({ nextHint, publicationSaw, read, save }) {
		const saved = yield* save("Ada's note");

		expect(saved).toEqual({ id: 1, title: "Ada's note" });
		yield* outcomes({
			"bounded publication attempts": [publicationSaw(), Array.from({ length: 3 }, () => [{ title: "Ada's note" }])],
			"local hint": [nextHint("local"), { _tag: "Resync" }],
			"remote hint": [nextHint("remote"), { _tag: "Resync" }],
			"saved notes": [read(), [{ id: 1, title: "Ada's note" }]],
		});
	},
);
