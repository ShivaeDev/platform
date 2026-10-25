import { Effect, Result } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"applies schema components after committing the ledger, including on a repeated migration run",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, assertPostgresMigrations }) {
		const { ledger, orders } = migrations();
		const loader = Migrator.fromRecord({ "1_orders": sql`create table ${sql(orders)} (id integer primary key)` });
		const index = `${orders}_index`;
		const component = {
			apply: sql`create index concurrently if not exists ${sql(index)} on ${sql(orders)} (id)`,
			name: "order index",
			pending: sql<{ name: string | null }>`select to_regclass(${index})::text as name`.pipe(
				Effect.map(([row]) => (row === undefined || row.name === null ? "index missing" : undefined)),
			),
		};
		const options = { components: [component], loader, lockTimeout: "5 seconds", table: ledger } as const;
		const pending = yield* assertPostgresMigrations(options).pipe(Effect.result);
		expect(pending).toMatchObject({
			_tag: "Failure",
			failure: { kind: "BadState", message: expect.stringContaining("migration 1 (orders); component order index: index missing") },
		});
		expect(yield* migratePostgres(options)).toEqual([[1, "orders"]]);
		yield* assertPostgresMigrations(options);
		yield* sql`drop index ${sql(index)}`;
		expect(yield* migratePostgres(options)).toEqual([]);
		yield* assertPostgresMigrations(options);
	},
);

postgres.it(
	"retains the committed ledger when a component fails and retries the component on the next run",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres }) {
		const { ledger, orders } = migrations();
		const loader = Migrator.fromRecord({ "1_orders": sql`create table ${sql(orders)} (id integer primary key)` });
		const options = { loader, lockTimeout: "5 seconds", table: ledger } as const;
		const failed = yield* migratePostgres({
			...options,
			components: [{ apply: Effect.fail("unavailable"), name: "jobs", pending: Effect.succeed("missing") }],
		}).pipe(Effect.result);
		expect(Result.isFailure(failed) && failed.failure).toMatchObject({
			cause: "unavailable",
			kind: "Failed",
			message: "Schema component jobs failed.",
		});
		expect(yield* sql`select migration_id from ${sql(ledger)}`).toEqual([{ "migration_id": 1 }]);
		expect(
			yield* migratePostgres({
				...options,
				components: [{ apply: sql`insert into ${sql(orders)} (id) values (42)`, name: "jobs", pending: Effect.succeed(undefined) }],
			}),
		).toEqual([]);
		expect(yield* sql`select id from ${sql(orders)}`).toEqual([{ id: 42 }]);
	},
);
