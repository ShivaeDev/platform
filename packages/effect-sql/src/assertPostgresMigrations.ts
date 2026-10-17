import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";

export const assertPostgresMigrations = Effect.fn("EffectSql.assertPostgresMigrations")(function* <R>({
	loader,
	table = "effect_sql_migrations",
}: Pick<Migrator.MigratorOptions<R>, "loader" | "table">) {
	const expected = yield* loader;
	if (expected.length === 0) {
		return;
	}
	const sql = yield* SqlClient.SqlClient;
	const identifier = sql`${sql(table)}`.compile()[0];
	const [ledger] = yield* sql<{ name: string | null }>`select to_regclass(${identifier})::text as name`.withoutTransform;
	function invalid() {
		return Effect.fail(
			new Migrator.MigrationError({ kind: "BadState", message: "Database migrations are not current; run the deployment migration command." }),
		);
	}
	if (ledger === undefined || ledger.name === null) {
		return yield* invalid();
	}
	const applied = yield* sql<{ id: number; name: string }>`select migration_id as id, name from ${sql(table)}`.withoutTransform;
	if (expected.some(([id, name]) => !applied.some((row) => row.id === id && row.name === name))) {
		return yield* invalid();
	}
});
