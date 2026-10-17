import { Effect, Option } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/effect-sql/migrations.ts";

function invalid(message: string) {
	return Effect.fail(new Migrator.MigrationError({ kind: "BadState", message }));
}

const outsideTransaction = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
	if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
		return yield* invalid("Migration steps must run outside a wrapping transaction.");
	}
});

export const migrationSteps = Effect.fn("PostgresTest.migrationSteps")(function* <R>(migrations: PostgresMigrationOptions<R>) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql.onDialectOrElse({ orElse: () => invalid("Migration steps require PostgreSQL."), pg: () => Effect.void });
	yield* outsideTransaction(sql);
	const resolved = yield* migrations.loader;
	const ledger = migrations.table ?? "effect_sql_migrations";
	const identifier = sql`${sql(ledger)}`.compile()[0];
	function run(loader: Migrator.Loader, target?: number) {
		return Effect.gen(function* () {
			yield* outsideTransaction(sql);
			if (target !== undefined) {
				const [existing] = yield* sql<{ readonly name: string | null }>`select to_regclass(${identifier})::text as name`.withoutTransform;
				if (existing !== undefined && existing.name !== null) {
					const later = yield* sql`select migration_id from ${sql(ledger)} where migration_id > ${target} limit 1`;
					if (later.length > 0) {
						return yield* invalid(`Cannot migrate to ${target}: later migrations are already applied.`);
					}
				}
			}
			return yield* migratePostgres({ ...migrations, loader }).pipe(Effect.provideService(SqlClient.SqlClient, sql));
		});
	}
	return {
		migrateTo: (name: string) => {
			const target = resolved.find(([id, label]) => `${id}_${label}` === name);
			return target === undefined
				? invalid(`Migration "${name}" is not in the loader.`)
				: run(Effect.succeed(resolved.filter(([id]) => id <= target[0])), target[0]);
		},
		migrateToLatest: run(Effect.succeed(resolved)),
	};
});
