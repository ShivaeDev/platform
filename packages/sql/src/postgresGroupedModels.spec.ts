import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { firstFood, groupedFoods, oatsStored, snakeCaseGroupedFoods } from "#test/groupedFoods.ts";

for (const kit of [groupedFoods, snakeCaseGroupedFoods]) {
	for (const write of ["insert", "insertPlain"] as const) {
		kit.it(`${write} round-trips grouped energy and preserves an insert-only source in flat PostgreSQL columns`, [], function* (verbs) {
			const inserted = yield* verbs[write]();

			expect(inserted).toMatchObject({ ...firstFood, id: 1, version: 0 });
			yield* outcomes([
				["decoded food", () => verbs.food(), { ...firstFood, id: 1, version: 0 }],
				[
					"stored columns",
					() => verbs.rawColumns(),
					[{ "energy_expected": "20", "energy_high": "30", "energy_low": "10", source: "nutrition label" }],
				],
				["selected group", () => verbs.listEnergy(), [{ energy: firstFood.energy }]],
			]);
		});
	}
}

groupedFoods.it("a chosen grouped update stores all three members and leaves the name alone", [oatsStored()], function* ({ food, replaceEnergy }) {
	yield* replaceEnergy();

	expect(yield* food()).toMatchObject({ energy: { expected: 21, high: 31, low: 11 }, name: "Oats", version: 1 });
});

for (const write of ["update", "updateVoid"] as const) {
	groupedFoods.it(
		`${write} of only name preserves the energy columns without selecting the row`,
		[oatsStored()],
		function* ({ food, rename, statementKinds }) {
			yield* rename(0, write);

			yield* outcomes([
				["stored food", () => food(), { ...firstFood, name: "Porridge", version: 1 }],
				["write statements", () => statementKinds(), ["update"]],
			]);
		},
	);

	groupedFoods.it(
		`${write} of only name refuses a stale version and keeps the newer grouped food`,
		[oatsStored()],
		function* ({ food, rename, replaceEnergy }) {
			yield* replaceEnergy();

			const refusal = yield* rename(0, write);

			expect(refusal).toBe("failed with a stale version conflict for 1 at version 0");
			expect(yield* food()).toMatchObject({ energy: { expected: 21, high: 31, low: 11 }, name: "Oats", version: 1 });
		},
	);
}
