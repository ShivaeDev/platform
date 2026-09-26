import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Cause, Effect, Exit } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, test } from "vitest";

const createFoods = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table food (id integer primary key, name text not null unique)`;
});

const seedFoods = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into food (name) values ('Apple')`;
});

const migrate = Migrator.make({});

const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(effect.pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))));

test("numbered migrations create a usable database and rerun without repeating writes", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const loader = Migrator.fromRecord({
				"2_seed_foods": seedFoods,
				"1_create_foods": createFoods,
			});

			expect(yield* migrate({ loader })).toEqual([
				[1, "create_foods"],
				[2, "seed_foods"],
			]);
			expect(yield* sql`select name from food`).toEqual([{ name: "Apple" }]);
			expect(yield* migrate({ loader })).toEqual([]);
			expect(yield* sql`select name from food`).toEqual([{ name: "Apple" }]);
			expect(yield* sql`select migration_id, name from effect_sql_migrations order by migration_id`).toEqual([
				{ migration_id: 1, name: "create_foods" },
				{ migration_id: 2, name: "seed_foods" },
			]);
		}),
	);
});

test("a failed pending migration rolls back its batch and ledger entries", async () => {
	await run(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* migrate({
				loader: Migrator.fromRecord({ "1_create_foods": createFoods }),
			});
			const exit = yield* migrate({
				loader: Migrator.fromRecord({
					"1_create_foods": createFoods,
					"2_seed_foods": seedFoods,
					"3_duplicate_food": seedFoods,
				}),
			}).pipe(Effect.exit);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.squash(exit.cause)).toMatchObject({
					_tag: "MigrationError",
					kind: "Failed",
				});
			}
			expect(yield* sql`select name from food`).toEqual([]);
			expect(yield* sql`select migration_id from effect_sql_migrations`).toEqual([{ migration_id: 1 }]);
		}),
	);
});
