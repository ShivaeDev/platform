import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { collection, invalidationKeys, readKeys } from "../src/index.ts";

const meals = collection("meals", Schema.Number);
const notes = collection("notes", Schema.String);

describe("reactivity keys", () => {
	it("registers items precisely and invalidates an item together with its list", () => {
		expect(readKeys([meals.item(1), meals.list, meals.item(1)])).toEqual(["meals:1", "meals"]);
		expect(invalidationKeys([meals.item(1), meals.item(2), notes.list])).toEqual(["meals:1", "meals", "meals:2", "notes"]);
	});

	it.effect("matches native record-key hashing: an item change refreshes that item and the list, not other items", () =>
		Effect.gen(function* () {
			const reactivity = yield* Reactivity.Reactivity;
			const refreshed: Array<string> = [];
			const watch = (label: string, keys: ReadonlyArray<string>) => reactivity.registerUnsafe(keys, () => refreshed.push(label));
			const release = [watch("meal 1", readKeys([meals.item(1)])), watch("meal 2", readKeys([meals.item(2)])), watch("list", readKeys([meals.list]))];
			yield* reactivity.invalidate(invalidationKeys([meals.item(1)]));
			expect(refreshed.sort()).toEqual(["list", "meal 1"]);
			refreshed.length = 0;
			yield* reactivity.invalidate({ meals: [1] });
			expect(refreshed.sort()).toEqual(["list", "meal 1"]);
			refreshed.length = 0;
			yield* reactivity.invalidate(invalidationKeys([meals.list]));
			expect(refreshed).toEqual(["list"]);
			for (const stop of release) stop();
		}).pipe(Effect.provide(Reactivity.layer)),
	);
});
