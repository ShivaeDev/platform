import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { purgeReaders } from "#test/purgeReaders.ts";

purgeReaders.it(
	"each committed retention batch delivers current item and bucket results to a viewer denied the collection",
	[],
	function* ({ collectionAccess, firstId, secondId, nextItem, nextBucket, start, nextBatch, finish }) {
		const first = firstId();
		const second = secondId();
		const original = [first, second];
		yield* outcomes([
			["collection access before retention", () => collectionAccess(), "denied"],
			["initial bucket results", () => nextBucket(), original],
			["initial item result", () => nextItem(), [first]],
		]);

		yield* start();

		const afterFirstBatch = yield* nextBucket();
		expect([[first], [second]]).toContainEqual(afterFirstBatch);
		if (!afterFirstBatch.includes(first)) {
			expect(yield* nextItem()).toEqual([]);
		}

		yield* nextBatch();

		yield* outcomes([
			["bucket results after the final batch", () => nextBucket(), []],
			["rows removed", () => finish(), original.length],
			["collection access after retention", () => collectionAccess(), "denied"],
		]);
		if (afterFirstBatch.includes(first)) {
			expect(yield* nextItem()).toEqual([]);
		}
	},
);
