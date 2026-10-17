import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "#test/eventually.ts";
import { nativeOnly, resumeStory } from "#test/resumeStory.ts";

resumeStory.it("visible browser resume, visible reconnect and native resume each refresh a query; hidden events do not", [], function* (test) {
	const release = test.watch(1);
	yield* eventually(() => expect(test.reads(1)).toBe(1));
	yield* test.loaded(1);
	test.fire("visibilitychange");
	yield* eventually(() => expect(test.reads(1)).toBe(2));
	test.fire("visibilitychange", "hidden");
	test.fire("online", "hidden");
	yield* Effect.sleep("20 millis");
	expect(test.reads(1)).toBe(2);
	test.fire("online");
	yield* eventually(() => expect(test.reads(1)).toBe(3));
	test.resume();
	yield* eventually(() => expect(test.reads(1)).toBe(4));
	expect(test.listeners()).toEqual([2, 1]);
	release();
	test.dispose();
	expect(test.listeners()).toEqual([0, 0]);
});

resumeStory.it("swr treats resume as a focus signal and only revalidates stale data", [nativeOnly()], function* (test) {
	test.watch(1, "fresh");
	test.watch(2, "stale");
	yield* eventually(() => expect([test.reads(1), test.reads(2)]).toEqual([1, 1]));
	yield* test.loaded(1);
	yield* test.loaded(2);
	expect(test.listeners()).toEqual([0, 1]);
	test.resume();
	yield* eventually(() => expect([test.reads(1), test.reads(2)]).toEqual([1, 2]));
	test.dispose();
	expect(test.listeners()).toEqual([0, 0]);
});
