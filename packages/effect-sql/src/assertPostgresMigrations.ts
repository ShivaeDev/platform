import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import type { PostgresMigrationOptions } from "./migrations.ts";
import { runSchemaComponent } from "./SchemaComponent.ts";

export const assertPostgresMigrations = Effect.fn("EffectSql.assertPostgresMigrations")(function* <R>({
	loader,
	components = [],
	table = "effect_sql_migrations",
}: Pick<PostgresMigrationOptions<R>, "loader" | "table" | "components">) {
	const expected = yield* loader;
	const pending: string[] = [];
	if (expected.length > 0) {
		const sql = yield* SqlClient.SqlClient;
		const identifier = sql`${sql(table)}`.compile()[0];
		const [ledger] = yield* sql<{ name: string | null }>`select to_regclass(${identifier})::text as name`.withoutTransform;
		const applied =
			ledger === undefined || ledger.name === null
				? []
				: yield* sql<{ id: number; name: string }>`select migration_id as id, name from ${sql(table)}`.withoutTransform;
		for (const [id, name] of expected) {
			if (!applied.some((row) => row.id === id && row.name === name)) {
				pending.push(`migration ${id} (${name})`);
			}
		}
	}
	for (const component of components) {
		const detail = yield* runSchemaComponent(component.name, component.pending);
		if (detail !== undefined) {
			pending.push(`component ${component.name}: ${detail}`);
		}
	}
	if (pending.length > 0) {
		return yield* Effect.fail(
			new Migrator.MigrationError({
				kind: "BadState",
				message: `Database migrations are not current: ${pending.join("; ")}. Run the deployment migration command.`,
			}),
		);
	}
});
