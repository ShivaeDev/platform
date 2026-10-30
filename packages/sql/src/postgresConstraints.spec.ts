import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { constraints, itemStored, type RawStatement } from "#test/constraints.ts";

constraints.it(
	"a transaction that reuses a taken name fails with name taken and rolls back its earlier insert",
	[itemStored("Original", 1)],
	function* ({ endings, insertItems, storedItems }) {
		yield* insertItems([
			{ name: "Must roll back", quantity: 2 },
			{ name: "Original", quantity: 3 },
		]);

		yield* outcomes({
			"stored items": [storedItems(), [{ name: "Original", quantity: 1 }]],
			"transaction ending": [endings(), ["failed with name taken"]],
		});
	},
);

for (const [violation, item, error] of [
	["a missing parent", { name: "Orphan", parentId: -1, quantity: 1 }, "parent missing"],
	["a negative quantity", { name: "Invalid", quantity: -1 }, "invalid quantity"],
] as const) {
	constraints.it(`an insert with ${violation} fails with ${error} and stores nothing`, [], function* ({ endings, insertItems, storedItems }) {
		yield* insertItems([item]);

		yield* outcomes({
			"insert ending": [endings(), [`failed with ${error}`]],
			"stored items": [storedItems(), []],
		});
	});
}

for (const [statement, error] of [
	["a negative quantity", "invalid quantity"],
	["a missing quantity", "storage unavailable"],
	["an unknown column", "storage unavailable"],
] as const satisfies readonly (readonly [RawStatement, string])[]) {
	constraints.it(
		`a raw statement with ${statement} mapped through the named constraints fails with ${error}`,
		[],
		function* ({ endings, runMapped }) {
			yield* runMapped(statement);

			expect(yield* endings()).toEqual([`failed with ${error}`]);
		},
	);
}
