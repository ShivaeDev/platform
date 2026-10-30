import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import type { PostgresMigrationOptions } from "./migrations.ts";
import { postgresRelease } from "./postgresRelease.ts";
import { runSchemaComponent, type SchemaComponent } from "./SchemaComponent.ts";

export interface PendingPostgresMigrations {
	readonly components: readonly { readonly name: string; readonly detail: string }[];
	readonly migrations: readonly { readonly id: number; readonly name: string }[];
}

export const pendingPostgresMigrations = Effect.fn("EffectSql.pendingPostgresMigrations")(function* <R, E = never>({
	loader,
	components = [],
	table = "effect_sql_migrations",
	release,
}: Pick<PostgresMigrationOptions<R, E>, "loader" | "table" | "components" | "release">) {
	const expected = yield* loader;
	const migrations: { id: number; name: string }[] = [];
	if (expected.length > 0) {
		const sql = yield* SqlClient.SqlClient;
		const identifier = sql`${sql(table)}`.compile()[0];
		const [ledger] = yield* sql`select to_regclass(${identifier})::text as name`.withoutTransform.pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ name: Schema.NullOr(Schema.String) })))),
		);
		const applied =
			ledger === undefined || ledger.name === null
				? []
				: yield* sql`select migration_id as id, name from ${sql(table)}`.withoutTransform.pipe(
						Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ id: Schema.Int, name: Schema.String })))),
					);
		for (const [id, name] of expected) {
			if (!applied.some((row) => row.id === id && row.name === name)) {
				migrations.push({ id, name });
			}
		}
	}
	const pendingComponents: { name: string; detail: string }[] = [];
	const schemaComponents: readonly SchemaComponent<R, E | SqlError | Schema.SchemaError>[] = [
		...components,
		...(release === undefined ? [] : [postgresRelease(release, table)]),
	];
	for (const component of schemaComponents) {
		const detail = yield* runSchemaComponent(component.name, component.pending);
		if (detail !== undefined) {
			pendingComponents.push({ detail, name: component.name });
		}
	}
	return { components: pendingComponents, migrations } satisfies PendingPostgresMigrations;
});
