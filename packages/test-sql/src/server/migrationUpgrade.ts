import { Effect, Option, Schema } from "effect";
import { Migrator, SqlClient, SqlSchema } from "effect/sql";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/sql/migrations.ts";
import { tableColumns } from "#server/tableColumns.ts";

export interface MigrationUpgradeOptions<R = never, E = never> {
	readonly migrations: PostgresMigrationOptions<R, E>;
	readonly table: string;
	readonly upTo: number;
}

export const migrationUpgrade = Effect.fn("PostgresTest.migrationUpgrade")(function* <R, E = never>(options: MigrationUpgradeOptions<R, E>) {
	const sql = yield* SqlClient.SqlClient;
	function invalid(message: string) {
		return Effect.fail(new Migrator.MigrationError({ kind: "BadState", message }));
	}
	yield* sql.onDialectOrElse({ orElse: () => invalid("Migration upgrade checks require PostgreSQL."), pg: () => Effect.void });
	if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
		return yield* invalid("Migration upgrade checks must run outside a wrapping transaction.");
	}
	const ledger = options.migrations.table ?? "effect_sql_migrations";
	const identifier = sql`${sql(ledger)}`.compile()[0];
	const existing = yield* SqlSchema.findAll({
		execute: () => sql`select to_regclass(${identifier})::text as name`.withoutTransform,
		Request: Schema.Void,
		Result: Schema.Struct({ name: Schema.NullOr(Schema.String) }),
	})(undefined);
	if (existing[0]?.name !== null) {
		const applied = yield* SqlSchema.findAll({
			execute: () => sql`select migration_id as "migrationId" from ${sql(ledger)} limit 1`.withoutTransform,
			Request: Schema.Void,
			Result: Schema.Struct({ migrationId: Schema.Unknown }),
		})(undefined);
		if (applied.length > 0) {
			return yield* invalid("Migration upgrade checks require an empty migration ledger.");
		}
	}
	const resolved = yield* options.migrations.loader;
	if (!resolved.some(([id]) => id === options.upTo)) {
		return yield* invalid(`Migration ${options.upTo} is not in the loader.`);
	}
	yield* migratePostgres({
		loader: Effect.succeed(resolved.filter(([id]) => id <= options.upTo)),
		lockTimeout: options.migrations.lockTimeout,
		table: ledger,
	});
	yield* migratePostgres({ ...options.migrations, loader: Effect.succeed(resolved) });
	return yield* tableColumns(options.table);
});
