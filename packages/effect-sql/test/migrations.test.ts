import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Cause, Effect, Exit } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";

const createOrders = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table orders (id integer primary key, name text not null unique)`;
});

const seedOrders = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into orders (name) values ('Printer paper')`;
});

const migrate = Migrator.make({});

const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(effect.pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))));

test("numbered migrations create a usable database and rerun without repeating writes", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const loader = Migrator.fromRecord({
				"2_seed_orders": seedOrders,
				"1_create_orders": createOrders,
			});

			expect(yield* migrate({ loader })).toEqual([
				[1, "create_orders"],
				[2, "seed_orders"],
			]);
			expect(yield* sql`select name from orders`).toEqual([{ name: "Printer paper" }]);
			expect(yield* migrate({ loader })).toEqual([]);
			expect(yield* sql`select name from orders`).toEqual([{ name: "Printer paper" }]);
			expect(yield* sql`select migration_id, name from effect_sql_migrations order by migration_id`).toEqual([
				{ migration_id: 1, name: "create_orders" },
				{ migration_id: 2, name: "seed_orders" },
			]);
		}),
	);
});

test("a failed pending migration rolls back its batch and ledger entries", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* migrate({
				loader: Migrator.fromRecord({ "1_create_orders": createOrders }),
			});
			const exit = yield* migrate({
				loader: Migrator.fromRecord({
					"1_create_orders": createOrders,
					"2_seed_orders": seedOrders,
					"3_duplicate_order": seedOrders,
				}),
			}).pipe(Effect.exit);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.squash(exit.cause)).toMatchObject({
					_tag: "MigrationError",
					kind: "Failed",
				});
			}
			expect(yield* sql`select name from orders`).toEqual([]);
			expect(yield* sql`select migration_id from effect_sql_migrations`).toEqual([{ migration_id: 1 }]);
		}),
	);
});
