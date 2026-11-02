import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionStreamsStory } from "#test/sessionStreamsStory.ts";

for (const [owner, caller] of [
	["alice", "bob"],
	["bob", "alice"],
] as const) {
	sessionStreamsStory.it(`${owner}'s stream uses their transport and headers when consumed by ${caller}`, [], function* ({ heard, start }) {
		yield* start(owner, caller, "preferences");

		expect(yield* heard("preferences")).toBe(`${owner}:${owner}:preferences`);
	});
}

sessionStreamsStory.it(
	"closing alice's session ends both her streams and closes their server subscriptions while bob's stays open",
	[],
	function* ({ closeSession, heard, openStreams, start, streamEnding, untilClosed }) {
		yield* start("alice", "bob", "first");
		yield* heard("first");
		yield* start("alice", "bob", "second");
		yield* heard("second");
		yield* start("bob", "bob", "bob");
		yield* heard("bob");
		expect(yield* openStreams()).toEqual(["first", "second", "bob"]);

		closeSession("alice");
		yield* untilClosed("first");
		yield* untilClosed("second");

		yield* outcomes([
			["first stream", () => streamEnding("first"), "interrupted"],
			["second stream", () => streamEnding("second"), "interrupted"],
			["open server streams", () => openStreams(), ["bob"]],
		]);
	},
);

sessionStreamsStory.it(
	"an unowned stream keeps the caller's transport and headers after alice's session closes",
	[],
	function* ({ closeSession, heard, openStreams, start }) {
		closeSession("alice");

		yield* start("ordinary", "bob", "public");

		yield* outcomes([
			["received value", () => heard("public"), "bob:bob:public"],
			["open server streams", () => openStreams(), ["public"]],
		]);
	},
);

sessionStreamsStory.it("interrupting the caller closes alice's server stream", [], function* ({ heard, interrupt, openStreams, start, untilClosed }) {
	yield* start("alice", "bob", "preferences");
	yield* heard("preferences");
	expect(yield* openStreams()).toEqual(["preferences"]);

	yield* interrupt("preferences");
	yield* untilClosed("preferences");

	expect(yield* openStreams()).toEqual([]);
});

sessionStreamsStory.it(
	"alice's finite stream delivers its value and completes through bob's runtime",
	[],
	function* ({ heard, start, streamEnding }) {
		yield* start("alice", "bob", "once", "finite");

		yield* outcomes([
			["received value", () => heard("once"), "alice:alice:once"],
			["stream", () => streamEnding("once"), "completed"],
		]);
	},
);

sessionStreamsStory.it("alice's refused stream retains its declared rejection through bob's runtime", [], function* ({ start, streamEnding }) {
	yield* start("alice", "bob", "refused", "refused");

	expect(yield* streamEnding("refused")).toBe("failed with unavailable");
});
