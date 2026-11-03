import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable, watching } from "#test/changeFeed.ts";

changeFeed.it(
	"a transaction refreshes its local bucket query and still publishes its shared writer's keys",
	[feedListens(), hasTable("rows"), watching("rows:2")],
	function* ({ announced, declareRowChange, inTransaction, insertRowWithRawSql, nextLiveRows, published, recordRowChange, watchRowsInParent }) {
		const local = yield* declareRowChange(1, 1);
		const shared = yield* declareRowChange(2, 2);
		yield* watchRowsInParent(1);
		expect(yield* nextLiveRows()).toEqual([]);

		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1, 1);
			yield* recordRowChange(local, { publication: "local" });
			yield* insertRowWithRawSql(2, 2);
			yield* recordRowChange(shared);
		});

		yield* outcomes([
			["local live query rows", () => nextLiveRows(), [1]],
			["shared reader refreshes", () => announced(), ["rows:2"]],
			["NOTIFY payloads", () => published(), [["rows:2", "rows", '["bucket","rows","parent",2]']]],
		]);
	},
);

changeFeed.it(
	"a rolled-back local savepoint leaves its outer shared write and publication intact",
	[feedListens(), hasTable("rows"), watching("rows:1", "rows:2")],
	function* ({ announced, declareRowChange, endings, inTransaction, insertRowWithRawSql, published, recordRowChange, rejects, storedRows }) {
		const shared = yield* declareRowChange(1, 1);
		const local = yield* declareRowChange(2, 2);

		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1, 1);
			yield* recordRowChange(shared);
			yield* inTransaction(function* () {
				yield* insertRowWithRawSql(2, 2);
				yield* recordRowChange(local, { publication: "local" });
				yield* rejects();
			});
		});

		yield* outcomes([
			["transaction outcomes", () => endings(), ["failed with rejected", "committed"]],
			["stored rows", () => storedRows(), [1]],
			["refreshed readers", () => announced(), ["rows:1"]],
			["NOTIFY payloads", () => published(), [["rows:1", "rows", '["bucket","rows","parent",1]']]],
		]);
	},
);
