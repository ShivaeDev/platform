import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { listening, othersPageOpen, pageOpen, viewerStory } from "#test/viewerStory.ts";

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

viewerStory.it("alice's subscription mixing her note and bob's note is refused whole", [], function* ({ subscribe }) {
	expect(yield* subscribe("alice", "note 1", "note 2")).toBe("failed with read denied");
});

viewerStory.it(
	"renaming alice's note 3 to One more adds it to her filtered page and leaves bob's page unread",
	[pageOpen("alice", "One"), pageOpen("bob")],
	function* ({ pageReads, rename, shown, untilPageReRead }) {
		yield* outcomes([
			["alice's page", () => shown("alice"), ["One"]],
			["bob's page", () => shown("bob"), ["Two"]],
		]);

		yield* rename("alice", 3, "One more");
		yield* untilPageReRead("alice");

		yield* outcomes([
			["alice's page", () => shown("alice"), ["One", "One more"]],
			["bob's page reads", () => pageReads("bob"), "read once"],
		]);
	},
);

viewerStory.it(
	"losing note 1 denies alice's whole subscription until access returns",
	[listening("alice", "note 1", "note 3")],
	function* ({ announce, handOver, rename, subscriptionDenial, untilNoteTitle, noteTitle }) {
		yield* handOver(1, "bob");

		yield* announce("alice", 1);

		expect(yield* subscriptionDenial("alice")).toBe("read denied");

		yield* handOver(1, "alice");
		yield* rename("alice", 3, "After denial");

		yield* untilNoteTitle("alice", 3, "After denial");
		expect(yield* noteTitle("alice", 3)).toBe("After denial");
	},
);
