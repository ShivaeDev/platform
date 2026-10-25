import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { PostgresMigrationOptions } from "./migrations.ts";
import { runSchemaComponent } from "./SchemaComponent.ts";

export interface PendingPostgresMigrations {
	readonly components: readonly { readonly name: string; readonly detail: string }[];
	readonly migrations: readonly { readonly id: number; readonly name: string }[];
}

export const pendingPostgresMigrations = Effect.fn("EffectSql.pendingPostgresMigrations")(function* <R>({
	loader,
	components = [],
	table = "effect_sql_migrations",
}: Pick<PostgresMigrationOptions<R>, "loader" | "table" | "components">) {
	const expected = yield* loader;
	const migrations: { id: number; name: string }[] = [];
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
				migrations.push({ id, name });
			}
		}
	}
	const pendingComponents: { name: string; detail: string }[] = [];
	for (const component of components) {
		const detail = yield* runSchemaComponent(component.name, component.pending);
		if (detail !== undefined) {
			pendingComponents.push({ detail, name: component.name });
		}
	}
	return { components: pendingComponents, migrations } satisfies PendingPostgresMigrations;
});
