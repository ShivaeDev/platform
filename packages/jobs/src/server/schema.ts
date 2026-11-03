import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { installSchema } from "#server/adapters/installSchema.ts";
import { type PgBossError, toPgBossError } from "#server/error.ts";

const InstalledSchema = Schema.Array(Schema.Struct({ name: Schema.NullOr(Schema.String) }));
const InstalledVersion = Schema.Array(Schema.Struct({ version: Schema.Number }));
const MissingArtifacts = Schema.Array(Schema.Struct({ name: Schema.String }));

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
			if (row === undefined || row.version < required) {
				return `schema ${schema}, installed version ${row?.version ?? "missing"}, required version ${required}`;
			}
			const job = sql`${sql(schema)}.${sql("job")}`;
			const deferrals = sql`${sql(schema)}.${sql("effect_job_deferral")}`;
			const cleanup = sql`${sql(schema)}.${sql("effect_job_deferral_keep_until")}`;
			const stately = sql`${sql(schema)}.${sql("effect_stately_deferral")}()`;
			const missing = yield* sql`SELECT name FROM (VALUES
				('dead-letter resolution trigger', EXISTS (
					SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass(${job.compile()[0]}) AND tgname = 'effect_dead_letter_resolution'
				)),
				('effect_job_deferral', to_regclass(${deferrals.compile()[0]}) IS NOT NULL),
				('effect_job_deferral_keep_until', to_regclass(${cleanup.compile()[0]}) IS NOT NULL),
				('effect_stately_deferral()', to_regprocedure(${stately.compile()[0]}) IS NOT NULL),
				('effect_stately_deferral trigger', EXISTS (
					SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass(${job.compile()[0]}) AND tgname = 'effect_stately_deferral'
				))
			) AS artifacts(name, installed) WHERE NOT installed`.withoutTransform.pipe(Effect.flatMap(Schema.decodeUnknownEffect(MissingArtifacts)));
			return missing.length === 0 ? undefined : `schema ${schema}, missing ${missing.map(({ name }) => name).join(", ")}`;
		}),
	};
}
