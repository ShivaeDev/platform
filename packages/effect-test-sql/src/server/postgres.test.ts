import { Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { integration, runAdmin, setup } from "#test/postgres.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

integration("fixtures are optional and migrations are copied to isolated databases", async () => {
	const kit = setup();
	await Effect.runPromise(
		withIsolatedDatabase(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select * from items`).toEqual([]);
				expect(yield* sql`select migration_id from effect_sql_migrations`).toEqual([{ "migration_id": 1 }]);
			}),
		).pipe(Effect.provide(makePostgresTestLayer({ migrations: kit.options.migrations, url: kit.options.url }))),
	);
	expect(kit.counts).toEqual({ fixtures: 0, migrations: 1 });
});

integration("sequence advances survive rollback while database clones start from the template's sequence state", async () => {
	const kit = setup();
	const layer = makePostgresTestLayer({
		migrations: {
			loader: Migrator.fromRecord({
				"1_create_sequence": Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					yield* sql`create sequence test_ids`;
				}),
			}),
			lockTimeout: "5 seconds",
		},
		url: kit.options.url,
	});
	const next = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql`select nextval('test_ids')::int as id`;
	});
	await Effect.runPromise(
		Effect.gen(function* () {
			expect(yield* withTestTransaction(next)).toEqual([{ id: 1 }]);
			expect(yield* next).toEqual([{ id: 2 }]);
			expect(yield* withIsolatedDatabase(next)).toEqual([{ id: 1 }]);
		}).pipe(Effect.provide(layer)),
	);
});

integration("failed template preparation preserves the failure and drops the database", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const admin = yield* SqlClient.SqlClient;
			const kit = setup();
			let name = "";
			const layer = makePostgresTestLayer({
				...kit.options,
				fixtures: Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					const [row] = yield* sql<{ name: string }>`select current_database() as name`;
					name = row?.name ?? "";
					return yield* Effect.fail("fixtures failed");
				}),
			});
			expect(yield* Effect.scoped(Layer.build(layer)).pipe(Effect.flip)).toBe("fixtures failed");
			expect(name).not.toBe("");
			expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([]);
		}),
	);
});
