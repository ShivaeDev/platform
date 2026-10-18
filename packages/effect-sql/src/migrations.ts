import { Duration, Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";

export interface PostgresMigrationOptions<R> {
	readonly loader: Migrator.Loader<R>;
	readonly lockTimeout: Duration.Input;
	readonly table?: string;
}

const migrate = Migrator.make({});

export const migratePostgres = Effect.fn("EffectSql.migratePostgres")(function* <R>({
	loader,
	table = "effect_sql_migrations",
	lockTimeout,
}: PostgresMigrationOptions<R>) {
	const sql = yield* SqlClient.SqlClient;
	const millis = Duration.toMillis(lockTimeout);
	const timeout = millis === Number.POSITIVE_INFINITY ? "0" : `${Math.max(1, Math.ceil(millis))}ms`;
	return yield* sql.withTransaction(
		Effect.gen(function* () {
			yield* sql`select set_config('lock_timeout', ${timeout}, true)`;
			yield* sql`select pg_advisory_xact_lock(hashtextextended(${`effect_sql_migrations:${table}`}, 0))`;
			yield* sql`create table if not exists ${sql(table)} (
  migration_id integer primary key,
  created_at timestamp with time zone not null default now(),
  name text not null
)`;
			const current = [...(yield* loader)].sort(([left], [right]) => left - right);
			const applied = yield* sql<{ id: number }>`select migration_id as id from ${sql(table)}`.withoutTransform;
			const appliedIds = new Set(applied.map(({ id }) => id));
			const latest = applied.reduce((max, { id }) => Math.max(max, id), 0);
			const missing = current.filter(([id]) => id <= latest && !appliedIds.has(id));
			if (missing.length > 0) {
				return yield* Effect.fail(
					new Migrator.MigrationError({
						kind: "BadState",
						message: `Migrations missing from the ledger at or below latest applied id ${latest}: ${missing.map(([id]) => id).join(", ")}`,
					}),
				);
			}
			return yield* migrate({ loader: Effect.succeed(current), table });
		}),
	);
});
