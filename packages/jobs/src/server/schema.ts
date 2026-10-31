import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Connection } from "effect/sql/SqlConnection";
import { getConstructionPlans, getMigrationPlans, PgBoss } from "pg-boss";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { type PgBossError, toPgBossError } from "#error.ts";
import { jobStorePlans } from "#internal/jobStorePlans.ts";
import { runSchemaPlan } from "#internal/runSchemaPlan.ts";
import { resumeSchemaIndexes } from "#internal/schemaIndexBuilds.ts";

const Partitions = Schema.Array(
	Schema.Struct({
		policy: Schema.String,
		tableName: Schema.String,
	}),
);
const InstalledSchema = Schema.Array(Schema.Struct({ name: Schema.NullOr(Schema.String) }));
const InstalledVersion = Schema.Array(Schema.Struct({ version: Schema.Number }));
const InstalledResolution = Schema.Array(Schema.Struct({ installed: Schema.Boolean }));

export interface PgBossSchemaOptions {
	readonly schema?: string;
}

async function installSchema(
	connection: Connection,
	options: PgBossSchemaOptions,
	run: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>,
): Promise<void> {
	const schema = options.schema ?? "pgboss";
	const construction = getConstructionPlans(schema);
	const client = new PgBoss({
		db: { executeSql: async (text, values = []) => ({ rows: Array.from(await run(connection.executeUnprepared(text, values, undefined))) }) },
		schema,
	});
	if (!(await client.isInstalled())) {
		await runSchemaPlan(connection, construction, run);
		return;
	}
	const version = await client.schemaVersion();
	if (version === null) {
		throw new Error("The pg-boss version table is empty");
	}
	if (version > pgBossPackage.pgboss.schema) {
		return;
	}
	if (version >= 27) {
		await resumeSchemaIndexes(client, schema);
	}
	if (version < pgBossPackage.pgboss.schema) {
		const partitionTables = Schema.decodeUnknownSync(Partitions)(
			await run(connection.executeUnprepared(`SELECT table_name AS "tableName", policy FROM ${schema}.queue WHERE partition = true`, [], undefined)),
		);
		await runSchemaPlan(connection, getMigrationPlans(schema, version, { partitionTables: Array.from(partitionTables) }), run, {
			schema,
			version: pgBossPackage.pgboss.schema,
		});
		await resumeSchemaIndexes(client, schema);
	}
}

export function installPgBossSchema(options: PgBossSchemaOptions = {}): Effect.Effect<void, PgBossError, SqlClient.SqlClient> {
	return Effect.scoped(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const connection = yield* sql.reserve;
			const run = Effect.runPromiseWith(yield* Effect.context<never>());
			yield* Effect.tryPromise({
				catch: (error) => error,
				try: async () => {
					await installSchema(connection, options, run);
					for (const plan of jobStorePlans(options.schema ?? "pgboss")) {
						await run(connection.executeRaw(plan, []));
					}
				},
			});
		}).pipe(Effect.mapError((error) => toPgBossError("install", error))),
	).pipe(Effect.uninterruptible);
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
			const [resolution] = yield* sql`SELECT EXISTS (
				SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass(${job.compile()[0]}) AND tgname = 'effect_dead_letter_resolution'
			) AS installed`.withoutTransform.pipe(Effect.flatMap(Schema.decodeUnknownEffect(InstalledResolution)));
			return resolution?.installed ? undefined : `schema ${schema}, missing dead-letter resolution trigger`;
		}),
	};
}
