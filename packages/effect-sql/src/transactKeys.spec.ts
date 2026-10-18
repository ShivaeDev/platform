import { Effect } from "effect";
import { expect } from "vitest";
import { onSqlError } from "#test/postgresTransact.ts";
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
