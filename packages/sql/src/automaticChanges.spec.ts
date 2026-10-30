import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable } from "#test/changeFeed.ts";

const THIRTY = Array.from({ length: 30 }, (_, id) => id);
const ROW_KEYS = ["rows", ...THIRTY.map((id) => `rows:${id}`)];

changeFeed.it(
	"repository writes in one transaction publish their table and each row key once, only after the commit",
	[feedListens(), hasTable("rows")],
	function* ({ deleteRow, inTransaction, insertRows, published, updateRowParent, upsertRowParent }) {
		yield* inTransaction(function* () {
			yield* insertRows(THIRTY);
			yield* updateRowParent(1, 0);
			yield* upsertRowParent(2, 1);
			yield* deleteRow(3);
			expect(yield* published()).toEqual([]);
		});

		expect(yield* published()).toEqual([ROW_KEYS]);
	},
);

changeFeed.it(
	"an insertMany outside a transaction commits on its own and publishes one payload of its table and row keys",
	[feedListens(), hasTable("rows")],
	function* ({ insertRows, published }) {
		yield* insertRows(THIRTY);

		expect(yield* published()).toEqual([ROW_KEYS]);
	},
);

changeFeed.it(
	"an insertManyOrIgnore whose rows all exist publishes nothing",
	[feedListens(), hasTable("rows")],
	function* ({ insertRows, insertRowsOrIgnore, published }) {
		yield* insertRows(THIRTY);
		expect(yield* published()).toEqual([ROW_KEYS]);

		yield* insertRowsOrIgnore(THIRTY);

		expect(yield* published()).toEqual([ROW_KEYS]);
	},
);

changeFeed.it(
	"a rejected transaction rolls back its repository write and publishes nothing",
	[feedListens(), hasTable("rows")],
	function* ({ endings, inTransaction, insertRow, published, rejects, storedRows }) {
		yield* inTransaction(function* () {
			yield* insertRow(1);
			yield* rejects();
		});

		yield* outcomes({
			"published payloads": [published(), []],
			"stored rows": [storedRows(), []],
			"transaction endings": [endings(), ["failed with rejected"]],
		});
	},
);

changeFeed.it(
	"a rejected nested transaction drops its row key while the outer transaction publishes its own",
	[feedListens(), hasTable("rows")],
	function* ({ endings, inTransaction, insertRow, published, rejects, storedRows }) {
		yield* inTransaction(function* () {
			yield* insertRow(2);
			yield* inTransaction(function* () {
				yield* insertRow(3);
				yield* rejects();
			});
		});

		yield* outcomes({
			"published payloads": [published(), [["rows", "rows:2"]]],
			"stored rows": [storedRows(), [2]],
			"transaction endings": [endings(), ["failed with rejected", "committed"]],
		});
	},
);

changeFeed.it("the change coverage check passes a repository insert", [hasTable("rows")], function* ({ checkChangeCoverage, insertRow }) {
	const ending = yield* checkChangeCoverage(function* () {
		yield* insertRow(1);
	});

	expect(ending).toBe("succeeded");
});

changeFeed.it(
	"the change coverage check fails a raw SQL insert that announces nothing and rolls it back",
	[hasTable("rows")],
	function* ({ checkChangeCoverage, insertRowWithRawSql, storedRows }) {
		const ending = yield* checkChangeCoverage(function* () {
			yield* insertRowWithRawSql(2);
		});

		expect(ending).toMatch(/^failed with unannounced writes/u);
		expect(yield* storedRows()).toEqual([]);
	},
);

changeFeed.it(
	"a void insert, a void update and a delete each publish their row key",
	[feedListens(), hasTable("rows")],
	function* ({ deleteRow, insertRowVoid, published, updateRowParentVoid }) {
		yield* insertRowVoid(41);
		yield* updateRowParentVoid(41, 41);
		yield* deleteRow(41);

		expect(yield* published()).toEqual([
			["rows", "rows:41"],
			["rows", "rows:41"],
			["rows", "rows:41"],
		]);
	},
);

changeFeed.it("deleting a missing row publishes nothing", [feedListens(), hasTable("rows")], function* ({ deleteRow, published }) {
	yield* deleteRow(41);

	expect(yield* published()).toEqual([]);
});
