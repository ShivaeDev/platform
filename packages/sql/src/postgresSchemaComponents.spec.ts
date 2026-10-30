import { Data, Effect, Schema } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

class ComponentUnavailable extends Data.TaggedError("ComponentUnavailable")<{ readonly cause: Error }> {}

postgres.it(
	"applies schema components after committing the ledger, including on a repeated migration run",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, assertPostgresMigrations, pendingPostgresMigrations }) {
		const { ledger, orders } = migrations();
		const loader = Migrator.fromRecord({ "1_orders": sql`create table ${sql(orders)} (id integer primary key)` });
		const index = `${orders}_index`;
		const component = {
			apply: sql`create index concurrently if not exists ${sql(index)} on ${sql(orders)} (id)`,
			name: "order index",
			pending: sql`select to_regclass(${index})::text as name`.pipe(
				Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ name: Schema.NullOr(Schema.String) })))),
				Effect.map(([row]) => (row === undefined || row.name === null ? "index missing" : undefined)),
			),
		};
		const options = { components: [component], loader, lockTimeout: "5 seconds", table: ledger } as const;
		expect(yield* pendingPostgresMigrations(options)).toEqual({
			components: [{ detail: "index missing", name: "order index" }],
			migrations: [{ id: 1, name: "orders" }],
		});
		const pending = yield* assertPostgresMigrations(options).pipe(Effect.result);
		expect(pending).toMatchObject({
			_tag: "Failure",
			failure: {
				kind: "BadState",
				message:
					"Database migrations are not current: migration 1 (orders); component order index: index missing. Run the deployment migration command.",
			},
		});
		expect(yield* migratePostgres(options)).toEqual([[1, "orders"]]);
		yield* assertPostgresMigrations(options);
		expect(yield* pendingPostgresMigrations(options)).toEqual({ components: [], migrations: [] });
		yield* sql`drop index ${sql(index)}`;
		expect(yield* pendingPostgresMigrations(options)).toEqual({ components: [{ detail: "index missing", name: "order index" }], migrations: [] });
		expect(yield* migratePostgres(options)).toEqual([]);
		yield* assertPostgresMigrations(options);
	},
);

postgres.it(
	"preserves and logs a component failure and its cause, keeps the ledger committed and retries on the next run",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, recordedLogs }) {
		const { ledger, orders } = migrations();
		const loader = Migrator.fromRecord({ "1_orders": sql`create table ${sql(orders)} (id integer primary key)` });
		const options = { loader, lockTimeout: "5 seconds", table: ledger } as const;
		const cause = new Error("component database unavailable");
		const failure = new ComponentUnavailable({ cause });
		const failed = yield* migratePostgres({
			...options,
			components: [{ apply: Effect.fail(failure), name: "jobs", pending: Effect.succeed("missing") }],
		}).pipe(Effect.flip);
		expect(failed).toBe(failure);
		expect(recordedLogs()).toContainEqual(
			expect.objectContaining({ cause: expect.stringContaining("ComponentUnavailable"), level: "Error", message: ["Schema component jobs failed."] }),
		);
		expect(recordedLogs()).toContainEqual(expect.objectContaining({ cause: expect.stringContaining(cause.message) }));
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
