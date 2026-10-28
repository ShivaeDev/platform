import { Schema } from "effect";
import { describe, expect } from "vitest";
import { collection, invalidationKeys, readKeys } from "@shivaedev/changes/keys.ts";
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
			refreshed.length = 0;
			yield* invalidate(["orders:*"]);
			expect(refreshed.sort((left, right) => left.localeCompare(right))).toEqual(["order 1", "order 2"]);
			for (const release of releases) {
				release();
			}
		},
	);
});

notesStory.it("item, list and wildcard invalidations preserve scope boundaries", [], function* ({ watchKeys, invalidate }) {
	const refreshed: string[] = [];
	const alice = { scope: "alice" };
	const bob = { scope: "bob" };
	const releases = [
		yield* watchKeys("alice one", readKeys([orders.item(1)], alice), refreshed),
		yield* watchKeys("alice two", readKeys([orders.item(2)], alice), refreshed),
		yield* watchKeys("alice list", readKeys([orders.list], alice), refreshed),
		yield* watchKeys("bob one", readKeys([orders.item(1)], bob), refreshed),
		yield* watchKeys("unscoped one", readKeys([orders.item(1)]), refreshed),
	];
	yield* invalidate(invalidationKeys([orders.item(1)], alice));
	expect(refreshed.sort((left, right) => left.localeCompare(right))).toEqual(["alice list", "alice one"]);
	refreshed.length = 0;
	yield* invalidate(invalidationKeys([orders.list], alice));
	expect(refreshed).toEqual(["alice list"]);
	refreshed.length = 0;
	const wildcard = readKeys([orders.item(1)], alice).slice(1);
	yield* invalidate(wildcard);
	expect(refreshed.sort((left, right) => left.localeCompare(right))).toEqual(["alice one", "alice two"]);
	for (const release of releases) {
		release();
	}
});
