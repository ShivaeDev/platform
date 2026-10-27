import { Clock, Effect } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"records the release last with a UTC timestamp and reports a different release as pending",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, readPostgresRelease, pendingPostgresMigrations }) {
		const table = migrations().ledger;
		const loader = Migrator.fromRecord({ "1_first": Effect.void });
		const before = yield* Clock.currentTimeMillis;
		yield* migratePostgres({
			components: [
				{
					apply: Effect.gen(function* () {
						expect(yield* readPostgresRelease(table)).toBeUndefined();
					}),
					name: "application schema",
					pending: Effect.succeed(undefined),
				},
			],
			loader,
			lockTimeout: "5 seconds",
			release: "first",
			table,
		});
		const marker = yield* readPostgresRelease(table);
		expect(marker?.release).toBe("first");
		expect(marker?.recordedAt).toBeInstanceOf(Date);
		expect(marker?.recordedAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(marker?.recordedAt.getTime()).toBeLessThanOrEqual(yield* Clock.currentTimeMillis);
		expect(
			yield* sql`select pg_typeof(recorded_at)::text as type, extract(timezone from recorded_at) as offset
		from ${sql(`${table}_release`)}`,
		).toEqual([{ offset: "0", type: "timestamp with time zone" }]);
		expect((yield* pendingPostgresMigrations({ loader, release: "second", table })).components).toEqual([
			{ detail: "Expected release second; recorded first", name: "database release" },
		]);
		yield* migratePostgres({ loader, lockTimeout: "5 seconds", release: "second", table });
		expect((yield* pendingPostgresMigrations({ loader, release: "second", table })).components).toEqual([]);
		expect((yield* readPostgresRelease(table))?.release).toBe("second");
		expect(yield* sql`select count(*)::integer as count from ${sql(`${table}_release`)}`).toEqual([{ count: 1 }]);
	},
);

postgres.it(
	"leaves release tables absent when no release is supplied",
	[hasMigrationTables()],
	function* ({ migrations, sql, migratePostgres, pendingPostgresMigrations }) {
		const table = migrations().ledger;
		const loader = Migrator.fromRecord({});
		yield* migratePostgres({ loader, lockTimeout: "5 seconds", table });
		expect(yield* pendingPostgresMigrations({ loader, table })).toEqual({ components: [], migrations: [] });
		expect(yield* sql`select to_regclass(${`${table}_release`}) as marker, to_regclass(${`${table}_workers`}) as workers`).toEqual([
			{ marker: null, workers: null },
		]);
		expect((yield* pendingPostgresMigrations({ loader, release: "first", table })).components).toEqual([
			{ detail: "Expected release first; recorded none", name: "database release" },
		]);
	},
);
