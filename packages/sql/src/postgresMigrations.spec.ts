import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"migratePostgres initializes, upgrades and reruns without repeating writes",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres }) {
		const { ledger, orders } = migrations();

		const initial = {
			"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
		};
		expect(yield* migratePostgres({ loader: Migrator.fromRecord(initial), lockTimeout: "5 seconds", table: ledger })).toEqual([[1, "create_orders"]]);
		const loader = Migrator.fromRecord({
			"2_seed_orders": sql`insert into ${sql(orders)} (name) values ('Printer paper')`.pipe(Effect.asVoid),
			...initial,
		});
		expect(yield* migratePostgres({ loader, lockTimeout: "5 seconds", table: ledger })).toEqual([[2, "seed_orders"]]);
		expect(yield* migratePostgres({ loader, lockTimeout: "5 seconds", table: ledger })).toEqual([]);
		expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "Printer paper" }]);
		expect(yield* sql`select migration_id, name from ${sql(ledger)} order by migration_id`).toEqual([
			{ "migration_id": 1, name: "create_orders" },
			{ "migration_id": 2, name: "seed_orders" },
		]);
	},
);

postgres.it(
	"migratePostgres rolls back pending DDL, data and ledger as one batch",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres }) {
		const { ledger, orders, audit } = migrations();

		const initial = {
			"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
		};
		yield* migratePostgres({ loader: Migrator.fromRecord(initial), lockTimeout: "5 seconds", table: ledger });
		const failure = yield* migratePostgres({
			loader: Migrator.fromRecord({
				...initial,
				"2_add_audit_and_seed": Effect.gen(function* () {
					yield* sql`create table ${sql(audit)} (name text)`;
					yield* sql`insert into ${sql(orders)} (name) values ('Printer paper')`;
				}),
				"3_duplicate_order": sql`insert into ${sql(orders)} (name) values ('Printer paper')`.pipe(Effect.asVoid),
			}),
			lockTimeout: "5 seconds",
			table: ledger,
		}).pipe(Effect.flip);
		expect(failure).toMatchObject({ _tag: "MigrationError", kind: "Failed" });
		expect(yield* sql`select name from ${sql(orders)}`).toEqual([]);
		expect(yield* sql`select to_regclass(${audit}) as table_name`).toEqual([{ "table_name": null }]);
		expect(yield* sql`select migration_id from ${sql(ledger)}`).toEqual([{ "migration_id": 1 }]);
	},
);

postgres.it(
	"migratePostgres serializes upgrades on an existing ledger and applies each migration once",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, advisoryXactLock, raceWithLock }) {
		const { ledger, orders } = migrations();
		yield* migratePostgres({
			loader: Migrator.fromRecord({
				"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
			}),
			lockTimeout: "5 seconds",
			table: ledger,
		});
		const options = {
			loader: Migrator.fromRecord({ "2_seed_orders": sql`insert into ${sql(orders)} (name) values ('Printer paper')`.pipe(Effect.asVoid) }),
			lockTimeout: "5 seconds",
			table: ledger,
		} as const;

		const results = yield* raceWithLock({
			effects: [migratePostgres(options), migratePostgres(options)],
			lock: advisoryXactLock(`effect_sql_migrations:${ledger}`),
		});

		expect(yield* Effect.forEach(results, Effect.fromResult)).toEqual(expect.arrayContaining([[[2, "seed_orders"]], []]));
		expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "Printer paper" }]);
		expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ "migration_id": 1 }, { "migration_id": 2 }]);
	},
	15_000,
);
