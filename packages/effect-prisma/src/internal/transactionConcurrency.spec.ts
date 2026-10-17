import { expect } from "vitest";
import { sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("does not serialize queries outside a transaction", [], function* ({ queryProbes }) {
	const result = yield* queryProbes.parallel();
	expect(result.maximumActive).toBe(2);
	expect(result.results).toEqual([
		[{ id: 1 }, { id: 2 }, { id: 3 }],
		[{ id: 1 }, { id: 2 }, { id: 3 }],
	]);
});

sqliteStory.it("serializes queries that share a transaction executor", [], function* ({ queryProbes }) {
	const result = yield* queryProbes.serialized();
	expect(result.startedBeforeRelease).toBe(1);
	expect(result.results).toEqual([
		[{ id: 1 }, { id: 2 }, { id: 3 }],
		[{ id: 1 }, { id: 2 }, { id: 3 }],
	]);
	expect(result.maximumActive).toBe(1);
});

sqliteStory.it("releases a transaction query permit after failure", [], function* ({ queryProbes }) {
	const result = yield* queryProbes.retry();
	expect(result.failed).toBe(true);
	expect(result.rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
});

sqliteStory.it("holds a transaction query permit until interrupted work settles", [], function* ({ queryProbes }) {
	const result = yield* queryProbes.interrupt();
	expect(result.attemptsBeforeRelease).toBe(1);
	expect(result.rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
});

sqliteStory.it("keeps a root stream incremental when root queries share an access permit", [], function* ({ queryProbes }) {
	const result = yield* queryProbes.incremental();
	expect(result.rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
	expect(result.events).toEqual(["source:start", "downstream:1", "downstream:2", "downstream:3", "source:end"]);
});

sqliteStory.it("buffers a transaction stream before running downstream effects", [], function* ({ queryProbes }) {
	const result = yield* queryProbes.buffered();
	expect(result.rows).toEqual([true, true, true]);
	expect(result.events).toEqual(["source:start", "source:end", "lookup", "lookup", "lookup"]);
});
