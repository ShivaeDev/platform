import { Effect, Option } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { migratePostgres, type PostgresMigrationOptions } from "@shivaedev/sql/migrations.ts";

function invalid(message: string) {
	return Effect.fail(new Migrator.MigrationError({ kind: "BadState", message }));
}

const outsideTransaction = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
	if (Option.isSome(yield* Effect.serviceOption(sql.transactionService))) {
		return yield* invalid("Migration steps must run outside a wrapping transaction.");
	}
});

export const migrationSteps = Effect.fn("PostgresTest.migrationSteps")(function* <R, E = never>(migrations: PostgresMigrationOptions<R, E>) {
	const sql = yield* SqlClient.SqlClient;
	const context = yield* Effect.context<R | SqlClient.SqlClient>();
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
			return yield* migratePostgres({ ...migrations, loader }).pipe(Effect.provideContext(context));
		});
	}
	return {
		migrateTo: (name: string | number) => {
			const match = /^(?<id>\d+)(?:_(?<label>.+))?$/u.exec(String(name))?.groups;
			const matches =
				match === undefined ? [] : resolved.filter(([id, label]) => id === Number(match.id) && (match.label === undefined || label === match.label));
			const [target] = matches;
			if (target === undefined) {
				return invalid(`Migration "${name}" is not in the loader.`);
			}
			if (matches.length > 1) {
				return invalid(`Migration "${name}" is ambiguous in the loader.`);
			}
			return run(Effect.succeed(resolved.filter(([id]) => id <= target[0])), target[0]);
		},
		migrateToLatest: run(Effect.succeed(resolved)),
	};
});
