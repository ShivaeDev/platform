import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { expect } from "vitest";
import { notes } from "#test/viewerEngine.ts";
import { viewerStory } from "#test/viewerStory.ts";

viewerStory.it("viewers hear allowed hints and report denied keys as unheard", [], function* ({ listen, rename, heard }) {
	const queries = [
		{ payload: { id: 1 }, query: "get" },
		{ payload: undefined, query: "list" },
	] as const;
	const alice = yield* listen("alice", queries);
	const bob = yield* listen("bob", queries);
	const waiting = yield* heard(alice, [notes.item(1), notes.list]).pipe(Effect.forkScoped);
	yield* rename("alice", 1, "Changed");
	expect(yield* Fiber.join(waiting)).toBe(true);
	expect(yield* heard(bob, [notes.list])).toBe(true);
	expect(yield* heard(bob, [notes.item(1)], { within: "20 millis" })).toBe(false);
});

viewerStory.it(
	"hint waiting expires on the story clock",
	[],
	function* ({ listen, heard }) {
		const bob = yield* listen("bob", [{ payload: { id: 1 }, query: "get" }]);
		const waiting = yield* heard(bob, [notes.item(1)], { within: "1 hour" }).pipe(Effect.forkScoped);
		yield* TestClock.adjust("1 hour");
		expect(yield* Fiber.join(waiting)).toBe(false);
	},
	{ clock: "test" },
);
