import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { notes } from "#test/viewerEngine.ts";
import { listening, othersPageOpen, pageOpen, unprotectedPageOpen, viewerStory } from "#test/viewerStory.ts";

for (const [viewer, answer] of [
	["alice", "note 1 titled One"],
	["bob", "failed with read denied"],
] as const) {
	viewerStory.it(`${viewer} reading alice's note 1 is answered with ${answer}`, [], function* ({ get }) {
		expect(yield* get(viewer, 1)).toBe(answer);
	});
}

for (const query of ["note 1", "alice's notes"] as const) {
	viewerStory.it(`bob's subscription to changes of ${query} is refused as read denied`, [], function* ({ subscribe }) {
		expect(yield* subscribe("bob", query)).toBe("failed with read denied");
	});
}

viewerStory.it("bob's page of alice's notes fails with read denied", [othersPageOpen("bob", "alice")], function* ({ shown }) {
	expect(yield* shown("bob")).toBe("failed with read denied");
});

viewerStory.it(
	"a page of a query without a read policy fails with a message telling its author to declare one",
	[unprotectedPageOpen("alice")],
	function* ({ shown }) {
		expect(yield* shown("alice")).toBe(
			"failed with missing read policy: Declare a readPolicy on query unprotected before running it live or subscribing",
		);
	},
);

viewerStory.it(
	"subscribing to changes of a query without a read policy fails with a message telling its author to declare one",
	[],
	function* ({ subscribe }) {
		expect(yield* subscribe("alice", "the unprotected notes")).toBe(
			"failed with missing read policy: Declare a readPolicy on query unprotected before running it live or subscribing",
		);
	},
);

viewerStory.it(
	"renaming alice's note 3, which her title filter excludes, still reaches her filtered subscription through her bucket",
	[listening("alice", "their notes titled One")],
	function* ({ heard, rename }) {
		yield* rename("alice", 3, "Still excluded");

		expect(yield* heard("alice", [notes.bucket.userId("alice")])).toBe("heard");
	},
);

viewerStory.it(
	"renaming alice's note 3 to One more adds it to her filtered page and leaves bob's page unread",
	[pageOpen("alice", "One"), pageOpen("bob")],
	function* ({ pageReads, rename, shown, untilPageReRead }) {
		yield* outcomes({
			"alice's page": [shown("alice"), ["One"]],
			"bob's page": [shown("bob"), ["Two"]],
		});

		yield* rename("alice", 3, "One more");
		yield* untilPageReRead("alice");

		yield* outcomes({
			"alice's page": [shown("alice"), ["One", "One more"]],
			"bob's page reads": [pageReads("bob"), "read once"],
		});
	},
);

viewerStory.it(
	"a change to note 1 announced while bob owns it never reaches alice's subscription to notes 1 and 3, so once note 1 returns to her she hears only the change to note 3",
	[listening("alice", "note 1", "note 3")],
	function* ({ announce, changesHeard, handOver, untilChangeArrives }) {
		yield* handOver(1, "bob");
		expect(yield* changesHeard("alice")).toEqual([]);

		yield* announce("alice", 1);

		yield* handOver(1, "alice");
		yield* announce("alice", 3);
		yield* untilChangeArrives("alice", 3);
		expect(yield* changesHeard("alice")).toEqual(["changed notes 3"]);
	},
);
