import { Schema } from "effect";
import { expect, it } from "vitest";
import { collection, invalidationKeys, readKeys } from "#keys.ts";

const orders = collection("orders", Schema.Number);
const notes = collection("notes", Schema.String);

it("registers items precisely and invalidates an item together with its list", () => {
	expect(readKeys([orders.item(1), orders.list, orders.item(1)])).toEqual(["orders:1", "orders:*", "orders"]);
	expect(invalidationKeys([orders.item(1), orders.item(2), notes.list])).toEqual(["orders:1", "orders", "orders:2", "notes"]);
});

it("builds a tuple bucket key from the text of its values in the declared column order", () => {
	const entries = collection("entries", Schema.Number, {}, { ownerDay: ["ownerId", "day"] });

	expect(invalidationKeys([entries.bucket.ownerDay({ day: 1, ownerId: "alice" })])).toEqual([
		'["bucket","entries","ownerDay","[\\"alice\\",\\"1\\"]"]',
	]);
});
