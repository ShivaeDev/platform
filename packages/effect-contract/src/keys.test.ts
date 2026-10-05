import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { collection, invalidationKeys, readKeys } from "#keys.ts";

const orders = collection("orders", Schema.Number);
const notes = collection("notes", Schema.String);

describe("reactivity keys", () => {
	it("registers items precisely and invalidates an item together with its list", () => {
		expect(readKeys([orders.item(1), orders.list, orders.item(1)])).toEqual(["orders:1", "orders"]);
		expect(invalidationKeys([orders.item(1), orders.item(2), notes.list])).toEqual(["orders:1", "orders", "orders:2", "notes"]);
	});

	it.effect("matches native record-key hashing: an item change refreshes that item and the list, not other items", () =>
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const refreshed: string[] = [];
			const watch = (label: string, keys: readonly string[]) => reactivity.registerUnsafe(keys, () => refreshed.push(label));
			const release = [
				watch("order 1", readKeys([orders.item(1)])),
				watch("order 2", readKeys([orders.item(2)])),
				watch("list", readKeys([orders.list])),
			];
			yield* reactivity.invalidate(invalidationKeys([orders.item(1)]));
			expect(refreshed.sort()).toEqual(["list", "order 1"]);
			refreshed.length = 0;
			yield* reactivity.invalidate({ orders: [1] });
			expect(refreshed.sort()).toEqual(["list", "order 1"]);
			refreshed.length = 0;
			yield* reactivity.invalidate(invalidationKeys([orders.list]));
			expect(refreshed).toEqual(["list"]);
			for (const stop of release) {
				stop();
			}
		}).pipe(Effect.provide(Reactivity.layer)),
	);
});
