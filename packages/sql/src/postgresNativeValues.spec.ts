import { expect } from "vitest";
import { nativeRows, nativeValues } from "#test/nativeValues.ts";

const first = { id: 9_007_199_254_740_993n, label: "First", values: [] };
const second = { id: 9_007_199_254_740_995n, label: "Second", values: [-2_147_483_648, 2_147_483_647] };
const quoted = { id: 9_007_199_254_740_997n, label: "x') or true --", values: [3] };

for (const id of [-9_223_372_036_854_775_808n, 9_223_372_036_854_775_807n]) {
	const row = { id, label: "Boundary", values: [] };
	nativeValues.it(`the int8 storage codec round-trips ${id} through native SqlSchema`, [nativeRows([row])], function* ({ list }) {
		const rows = yield* list([row.label], false);

		expect(rows).toEqual([row]);
	});
}

for (const qualified of [false, true]) {
	for (const [description, labels, expected] of [
		["an empty list matches nothing", [], []],
		["a singleton list selects its row", ["First"], [first]],
		["a list selects both matching rows", ["Second", "First"], [first, second]],
		["an absent value matches nothing", ["Missing"], []],
		["duplicate values return a matching row once", ["First", "First"], [first]],
		["SQL-shaped text remains a bound value", [quoted.label], [quoted]],
	] as const) {
		nativeValues.it(
			`${description} through native SqlSchema with ${qualified ? "a qualified column" : "a column name"}`,
			[nativeRows([first, second, quoted])],
			function* ({ list }) {
				const rows = yield* list(labels, qualified);

				expect(rows).toEqual(expected);
			},
		);
	}
}

for (const [description, row] of [
	["bigint", { id: -1n, label: "Negative id", values: [1] }],
	["integer-array", { id: 1n, label: "Negative element", values: [-1] }],
] as const) {
	nativeValues.it(
		`a native SqlSchema read rejects a stored value outside the supplied ${description} field schema`,
		[nativeRows([row])],
		function* ({ restrictedRows }) {
			const result = yield* restrictedRows();

			expect(result).toBe("failed with a schema error");
		},
	);
}
