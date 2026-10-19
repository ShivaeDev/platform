import { Schema } from "effect";
import { describe, expect } from "vitest";
import { collection, invalidationKeys, readKeys } from "#keys.ts";
import { notesStory } from "#test/notesStory.ts";

const orders = collection("orders", Schema.Number);

describe("reactivity keys", () => {
	notesStory.it(
		"matches native record-key hashing: an item change refreshes that item and the list, not other items",
		[],
		function* ({ watchKeys, invalidate }) {
			const refreshed: string[] = [];
			const releases = [
				yield* watchKeys("order 1", readKeys([orders.item(1)]), refreshed),
				yield* watchKeys("order 2", readKeys([orders.item(2)]), refreshed),
				yield* watchKeys("list", readKeys([orders.list]), refreshed),
			];
			yield* invalidate(invalidationKeys([orders.item(1)]));
			expect(refreshed.sort((left, right) => left.localeCompare(right))).toEqual(["list", "order 1"]);
			refreshed.length = 0;
			yield* invalidate({ orders: [1] });
			expect(refreshed.sort((left, right) => left.localeCompare(right))).toEqual(["list", "order 1"]);
			refreshed.length = 0;
			yield* invalidate(invalidationKeys([orders.list]));
			expect(refreshed).toEqual(["list"]);
			for (const release of releases) {
				release();
			}
		},
	);
});
