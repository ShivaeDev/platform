import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bigintStory, watching } from "#test/bigintStory.ts";

bigintStory.it(
	"queries for bigint ids 1, 1 and 2 share one live subscription per record, each naming its bigint id",
	[watching(1n, 1n, 2n)],
	function* ({ subscriptions }) {
		expect(yield* subscriptions()).toEqual(["get by bigint id 1", "get by bigint id 2"]);
	},
);

bigintStory.it(
	"an announced change to record 1 re-reads it and leaves record 2 unread",
	[watching(1n, 2n)],
	function* ({ announce, changeQuietly, shown, timesRead, untilReRead }) {
		changeQuietly(1n, "Changed");
		expect(yield* shown(1n)).toBe("First");

		yield* announce(1n);
		yield* untilReRead(1n);

		yield* outcomes({
			"record 1": [shown(1n), "Changed"],
			"record 2's reads": [timesRead(2n), "read once"],
		});
	},
);
