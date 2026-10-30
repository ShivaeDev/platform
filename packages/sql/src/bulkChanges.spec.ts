import { expect } from "vitest";
import { changeFeed, feedListens, hasTable, idsFrom, keysOf } from "#test/changeFeed.ts";

const ROWS = idsFrom(0, 1001);

for (const count of [1000, 1001]) {
	changeFeed.it(
		`an insertMany of ${count} rows publishes every row key only after its transaction commits`,
		[feedListens(), hasTable("rows")],
		function* ({ inTransaction, insertRows, publishedKeys }) {
			yield* inTransaction(function* () {
				yield* insertRows(idsFrom(0, count));
				expect(yield* publishedKeys()).toEqual([]);
			});

			expect(yield* publishedKeys()).toEqual(keysOf("rows", idsFrom(0, count)));
		},
	);
}

changeFeed.it(
	"an upsertMany that only updates 1001 existing rows publishes every row key",
	[feedListens(), hasTable("rows")],
	function* ({ insertRows, publishedKeys, upsertRows }) {
		yield* insertRows(ROWS);
		expect(yield* publishedKeys()).toEqual(keysOf("rows", ROWS));

		yield* upsertRows(ROWS, 0);

		expect(yield* publishedKeys()).toEqual([...keysOf("rows", ROWS), ...keysOf("rows", ROWS)]);
	},
);

changeFeed.it(
	"an insertManyOrIgnore across statement chunks publishes only the rows it inserted",
	[feedListens(), hasTable("rows")],
	function* ({ insertRow, insertRowsOrIgnore, publishedKeys }) {
		yield* insertRow(0);
		expect(yield* publishedKeys()).toEqual(keysOf("rows", [0]));

		yield* insertRowsOrIgnore(ROWS);

		expect(yield* publishedKeys()).toEqual([...keysOf("rows", [0]), ...keysOf("rows", idsFrom(1, 1000))]);
	},
);

changeFeed.it(
	"a conditional upsertMany across statement chunks publishes every row it changed",
	[feedListens(), hasTable("rows")],
	function* ({ insertRows, publishedKeys, upsertParentlessRows }) {
		yield* insertRows(ROWS);
		expect(yield* publishedKeys()).toEqual(keysOf("rows", ROWS));

		yield* upsertParentlessRows(ROWS, 0);

		expect(yield* publishedKeys()).toEqual([...keysOf("rows", ROWS), ...keysOf("rows", ROWS)]);
	},
);
