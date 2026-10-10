import { Effect } from "effect";
import { expect } from "vitest";
import { integration, onSqlError, runPostgres, setup } from "#test/postgres-transact.ts";
import { invalidateOnCommit, transact } from "#transact.ts";

integration("a bigint row key beyond Number precision invalidates its exact string key after commit", () =>
	runPostgres(
		Effect.gen(function* () {
			const { sql, tables, reactivity } = yield* setup;
			yield* sql`alter table ${sql(tables.orders)} alter column id type bigint`;
			const id = 9_007_199_254_740_993n;
			const changed: string[] = [];
			const key = `orders:${id}`;
			reactivity.registerUnsafe([key], () => changed.push(key));

			yield* Effect.gen(function* () {
				yield* sql`insert into ${sql(tables.orders)} (id, name) values (${String(id)}::bigint, 'large identity')`;
				yield* invalidateOnCommit({ orders: [id] });
				expect(changed).toEqual([]);
			}).pipe(transact({ onSqlError }));

			expect(changed).toEqual([key]);
			expect(yield* sql`select id::text as id from ${sql(tables.orders)}`).toEqual([{ id: String(id) }]);
		}),
	),
);
