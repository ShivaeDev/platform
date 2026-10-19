import { Effect } from "effect";
import { expect } from "vitest";
import { onSqlError } from "#test/postgresTransact.ts";
import { hasCompositeLedger } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasBigintKeys, hasTransactionTables } from "#test/sqlTraits.ts";

postgres.it(
	"a bigint row key beyond Number precision invalidates its exact string key after commit",
	[hasTransactionTables(), hasBigintKeys()],
	function* ({ transactions, sql, transact, invalidateOnCommit, watchChanges }) {
		const { tables } = transactions();
		const id = 9_007_199_254_740_993n;
		const key = `orders:${id}`;
		const changed = yield* watchChanges([key]);

		yield* Effect.gen(function* () {
			yield* sql`insert into ${sql(tables.orders)} (id, name) values (${String(id)}::bigint, 'large identity')`;
			yield* invalidateOnCommit({ orders: [id] });
			expect(changed).toEqual([]);
		}).pipe(transact({ onSqlError }));

		expect(changed).toEqual([key]);
		expect(yield* sql`select id::text as id from ${sql(tables.orders)}`).toEqual([{ id: String(id) }]);
	},
);

postgres.it(
	"repository writes to a composite key with a bigint column announce its decimal item key after each commit",
	[hasCompositeLedger()],
	function* ({ compositeLedger, transact, watchChanges }) {
		const { entries, tableName } = compositeLedger();
		const sequence = 9_007_199_254_740_993n;
		const key = `${tableName}:["cash","${sequence}"]`;
		const changed = yield* watchChanges([key]);

		const row = yield* Effect.gen(function* () {
			const inserted = yield* entries.insert({ account: "cash", amount: "7", sequence });
			expect(changed).toEqual([]);
			return inserted;
		}).pipe(transact({ onSqlError }));
		expect(row.sequence).toBe(sequence);
		expect(changed).toEqual([key]);

		yield* entries.update({ ...row, amount: "8" });
		expect(changed).toEqual([key, key]);

		yield* entries.delete({ account: "cash", sequence });
		expect(changed).toEqual([key, key, key]);
	},
);
