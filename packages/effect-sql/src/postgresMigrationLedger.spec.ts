import { Effect, Result } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it("migratePostgres refuses migration 2 after applying 1 and 3", [hasMigrationTables()], function* ({ migrations, sql, migrate }) {
	const { ledger, orders } = migrations();
	const initial = {
		"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
		"3_seed_orders": sql`insert into ${sql(orders)} (name) values ('three')`.pipe(Effect.asVoid),
	};
	yield* migrate({ loader: Migrator.fromRecord(initial), table: ledger });
	const result = yield* migrate({
		loader: Migrator.fromRecord({
			...initial,
			"2_late_order": sql`insert into ${sql(orders)} (name) values ('two')`.pipe(Effect.asVoid),
			"4_pending_order": sql`insert into ${sql(orders)} (name) values ('four')`.pipe(Effect.asVoid),
		}),
		table: ledger,
	}).pipe(Effect.result);
	expect(Result.isFailure(result) && result.failure).toBeInstanceOf(Migrator.MigrationError);
	expect(Result.isFailure(result) && result.failure).toMatchObject({
		kind: "BadState",
		message: "Migrations missing from the ledger at or below latest applied id 3: 2",
	});
	expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "three" }]);
	expect(yield* sql`select migration_id from ${sql(ledger)} order by migration_id`).toEqual([{ "migration_id": 1 }, { "migration_id": 3 }]);
});

postgres.it(
	"migratePostgres applies migration 4 after a complete ledger of 1 through 3",
	[hasMigrationTables()],
	function* ({ migrations, sql, migrate }) {
		const { ledger, orders } = migrations();
		const initial = {
			"1_create_orders": sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid),
			"2_seed_orders": sql`insert into ${sql(orders)} (name) values ('two')`.pipe(Effect.asVoid),
			"3_update_orders": sql`update ${sql(orders)} set name = name || '-three'`.pipe(Effect.asVoid),
		};
		yield* migrate({ loader: Migrator.fromRecord(initial), table: ledger });
		expect(
			yield* migrate({
				loader: Migrator.fromRecord({
					"4_update_orders": sql`update ${sql(orders)} set name = name || '-four'`.pipe(Effect.asVoid),
					...initial,
				}),
				table: ledger,
			}),
		).toEqual([[4, "update_orders"]]);
		expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "two-three-four" }]);
	},
);

postgres.it("migratePostgres runs every migration in id order on a fresh ledger", [hasMigrationTables()], function* ({ migrations, sql, migrate }) {
	const { ledger, orders } = migrations();
	const loader: Migrator.Loader = Effect.succeed([
		[3, "update_orders", Effect.succeed(sql`update ${sql(orders)} set name = name || '-three'`.pipe(Effect.asVoid))],
		[1, "create_orders", Effect.succeed(sql`create table ${sql(orders)} (name text primary key)`.pipe(Effect.asVoid))],
		[2, "seed_orders", Effect.succeed(sql`insert into ${sql(orders)} (name) values ('two')`.pipe(Effect.asVoid))],
	]);
	expect(yield* migrate({ loader, table: ledger })).toEqual([
		[1, "create_orders"],
		[2, "seed_orders"],
		[3, "update_orders"],
	]);
	expect(yield* sql`select name from ${sql(orders)}`).toEqual([{ name: "two-three" }]);
});
