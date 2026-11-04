import { expect } from "vitest";
import { sqlTransact } from "@shivaedev/quality/rules/effect/sqlTransact.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { feedListens, hasTable } from "#test/changeFeed.ts";
import { consumerHas, consumerPackages, consumerTransaction, repositoryTransactions } from "#test/repositoryTransactions.ts";

repositoryTransactions.it(
	"Quality reports transact for two repository writes wrapped in a native transaction before the consumer runs",
	[consumerPackages(), consumerHas(consumerTransaction("native")), hasTable("rows")],
	function* ({ check }) {
		const findings = yield* check(sqlTransact);

		expect(findings).toEqual([
			{
				file: "src/save.ts",
				line: 8,
				message:
					"Uses native sql.withTransaction around repository writes or change announcements. Begin the outer transaction with transact(effect, { onSqlError }) so changed keys follow its commit.",
			},
		]);
	},
);

repositoryTransactions.it(
	"the transact repair passes Quality and two repository writes publish one batch only after their PostgreSQL commit",
	[consumerPackages(), consumerHas(consumerTransaction("transact")), feedListens(), hasTable("rows")],
	function* ({ check, inTransaction, insertRow, published, storedRows }) {
		expect(yield* check(sqlTransact)).toEqual([]);

		yield* inTransaction(function* () {
			yield* insertRow(1);
			yield* insertRow(2);
			expect(yield* published()).toEqual([]);
		});

		yield* outcomes([
			["published payloads", () => published(), [["rows", "rows:1", "rows:2"]]],
			["stored rows", () => storedRows(), [1, 2]],
		]);
	},
);

repositoryTransactions.it(
	"a rejected transact rolls back two repository writes and publishes nothing on PostgreSQL",
	[feedListens(), hasTable("rows")],
	function* ({ endings, inTransaction, insertRow, published, rejects, storedRows }) {
		yield* inTransaction(function* () {
			yield* insertRow(1);
			yield* insertRow(2);
			yield* rejects();
		});

		yield* outcomes([
			["published payloads", () => published(), []],
			["stored rows", () => storedRows(), []],
			["transaction endings", () => endings(), ["failed with rejected"]],
		]);
	},
);
