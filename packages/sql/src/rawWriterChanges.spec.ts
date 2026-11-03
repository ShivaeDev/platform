import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable, watching } from "#test/changeFeed.ts";

const ROW_KEYS = ["rows:1", "rows", '["bucket","rows","parent",1]'];

changeFeed.it(
	"a raw writer's declaration refreshes readers and publishes its record, table and bucket keys only after commit",
	[feedListens(), hasTable("rows"), watching("rows:1")],
	function* ({ announced, declareRowChange, inTransaction, insertRowWithRawSql, published, recordRowChange }) {
		const changed = yield* declareRowChange(1, 1);

		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1, 1);
			yield* recordRowChange(changed);
			yield* outcomes([
				["readers before commit", () => announced(), []],
				["NOTIFY before commit", () => published(), []],
			]);
		});

		yield* outcomes([
			["refreshed readers", () => announced(), ["rows:1"]],
			["NOTIFY payloads", () => published(), [ROW_KEYS]],
		]);
	},
);

changeFeed.it(
	"a local raw write refreshes a live bucket query after commit without NOTIFY",
	[feedListens(), hasTable("rows")],
	function* ({ declareRowChange, inTransaction, insertRowWithRawSql, nextLiveRows, published, recordRowChange, watchRowsInParent }) {
		const changed = yield* declareRowChange(1, 1);
		yield* watchRowsInParent(1);
		expect(yield* nextLiveRows()).toEqual([]);

		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1, 1);
			yield* recordRowChange(changed, { publication: "local" });
		});

		yield* outcomes([
			["live query rows", () => nextLiveRows(), [1]],
			["NOTIFY payloads", () => published(), []],
		]);
	},
);

for (const publication of ["shared", "local"] as const) {
	changeFeed.it(
		`a rolled-back ${publication} raw write stores no row and refreshes no reader or process`,
		[feedListens(), hasTable("rows"), watching("rows:1")],
		function* ({ announced, declareRowChange, endings, inTransaction, insertRowWithRawSql, published, recordRowChange, rejects, storedRows }) {
			const changed = yield* declareRowChange(1, 1);

			yield* inTransaction(function* () {
				yield* insertRowWithRawSql(1, 1);
				yield* recordRowChange(changed, { publication });
				yield* rejects();
			});

			yield* outcomes([
				["transaction outcome", () => endings(), ["failed with rejected"]],
				["stored rows", () => storedRows(), []],
				["refreshed readers", () => announced(), []],
				["NOTIFY payloads", () => published(), []],
			]);
		},
	);

	changeFeed.it(
		`coverage accepts the same declaration a ${publication} raw writer records`,
		[feedListens(), hasTable("rows")],
		function* ({ checkDeclaredCoverage, declareRowChange, insertRowWithRawSql, recordRowChange, storedRows }) {
			const changed = yield* declareRowChange(1, 1);

			const result = yield* checkDeclaredCoverage(function* () {
				yield* insertRowWithRawSql(1, 1);
				yield* recordRowChange(changed, { publication });
			}, changed);

			expect(result).toBe("covered");
			expect(yield* storedRows()).toEqual([1]);
		},
	);
}

changeFeed.it(
	"coverage rolls back an unrecorded raw write using its change declaration",
	[feedListens(), hasTable("rows")],
	function* ({ checkDeclaredCoverage, declareRowChange, insertRowWithRawSql, published, storedRows }) {
		const changed = yield* declareRowChange(1, 1);

		const result = yield* checkDeclaredCoverage(function* () {
			yield* insertRowWithRawSql(1, 1);
		}, changed);

		expect(result).toBe("unannounced writes");
		yield* outcomes([
			["stored rows", () => storedRows(), []],
			["NOTIFY payloads", () => published(), []],
		]);
	},
);

for (const first of ["local", "shared"] as const) {
	changeFeed.it(
		`recording the same keys as ${first} and then ${first === "local" ? "shared" : "local"} publishes and refreshes once`,
		[feedListens(), hasTable("rows"), watching("rows:1")],
		function* ({ announced, declareRowChange, inTransaction, insertRowWithRawSql, published, recordRowChange }) {
			const changed = yield* declareRowChange(1, 1);

			yield* inTransaction(function* () {
				yield* insertRowWithRawSql(1, 1);
				yield* recordRowChange(changed, { publication: first });
				yield* recordRowChange(changed, { publication: first === "local" ? "shared" : "local" });
			});

			yield* outcomes([
				["refreshed readers", () => announced(), ["rows:1"]],
				["NOTIFY payloads", () => published(), [ROW_KEYS]],
			]);
		},
	);
}
