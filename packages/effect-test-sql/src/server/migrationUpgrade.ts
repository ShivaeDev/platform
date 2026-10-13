import { Effect, Option } from "effect";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/effect-sql/migrations.ts";

export interface PostgresColumn {
	readonly name: string;
	readonly type: string;
}

export interface MigrationUpgradeOptions<R = never> {
	readonly migrations: PostgresMigrationOptions<R>;
	readonly table: string;
	readonly upTo: number;
}

export const migrationUpgrade = Effect.fn("PostgresTest.migrationUpgrade")(function* <R>(options: MigrationUpgradeOptions<R>) {
	const sql = yield* SqlClient.SqlClient;
	function invalid(message: string) {
		return Effect.fail(new Migrator.MigrationError({ kind: "BadState", message }));
	}
	yield* sql.onDialectOrElse({ orElse: () => invalid("Migration upgrade checks require PostgreSQL."), pg: () => Effect.void });
	if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
		return yield* invalid("Migration upgrade checks must run outside a wrapping transaction.");
	}
	const ledger = options.migrations.table ?? "effect_sql_migrations";
	const existing = yield* sql<{ readonly name: string | null }>`select to_regclass(${ledger})::text as name`.withoutTransform;
	if (existing[0]?.name !== null) {
		const applied = yield* sql`select migration_id from ${sql(ledger)} limit 1`;
		if (applied.length > 0) {
			return yield* invalid("Migration upgrade checks require an empty migration ledger.");
		}
	}
	const resolved = yield* options.migrations.loader;
	if (!resolved.some(([id]) => id === options.upTo)) {
		return yield* invalid(`Migration ${options.upTo} is not in the loader.`);
	}
	yield* migratePostgres({ ...options.migrations, loader: Effect.succeed(resolved.filter(([id]) => id <= options.upTo)) });
	yield* migratePostgres({ ...options.migrations, loader: Effect.succeed(resolved) });
	return yield* sql<PostgresColumn>`
		select attname as name, format_type(atttypid, atttypmod) as type
		from pg_attribute
		where attrelid = ${options.table}::regclass and attnum > 0 and not attisdropped
		order by attname`.withoutTransform;
});
