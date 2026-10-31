import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { installSchema } from "#adapters/installSchema.ts";
import { type PgBossError, toPgBossError } from "#error.ts";

const InstalledSchema = Schema.Array(Schema.Struct({ name: Schema.NullOr(Schema.String) }));
const InstalledVersion = Schema.Array(Schema.Struct({ version: Schema.Number }));

export interface PgBossSchemaOptions {
	readonly schema?: string;
}

export function installPgBossSchema(options: PgBossSchemaOptions = {}): Effect.Effect<void, PgBossError, SqlClient.SqlClient> {
	return Effect.scoped(installSchema(options)).pipe(
		Effect.mapError((error) => toPgBossError("install", error)),
		Effect.uninterruptible,
	);
}

export function pgBossSchema(options: PgBossSchemaOptions = {}): SchemaComponent {
	const schema = options.schema ?? "pgboss";
	return {
		apply: installPgBossSchema(options),
		name: `pg-boss:${schema}`,
		pending: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const table = sql`${sql(schema)}.${sql("version")}`;
			const [installed] = yield* sql`select to_regclass(${table.compile()[0]})::text as name`.withoutTransform.pipe(
				Effect.flatMap(Schema.decodeUnknownEffect(InstalledSchema)),
			);
			const [row] =
				installed === undefined || installed.name === null
					? []
					: yield* sql`select version from ${table}`.withoutTransform.pipe(Effect.flatMap(Schema.decodeUnknownEffect(InstalledVersion)));
			const required = pgBossPackage.pgboss.schema;
			return row === undefined || row.version < required
				? `schema ${schema}, installed version ${row?.version ?? "missing"}, required version ${required}`
				: undefined;
		}),
	};
}
