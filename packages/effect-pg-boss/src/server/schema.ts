import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Connection } from "effect/sql/SqlConnection";
import { getConstructionPlans, getMigrationPlans, type MigrationPartition, PgBoss } from "pg-boss";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import { type PgBossError, toPgBossError } from "#error.ts";
import { runSchemaPlan } from "#internal/runSchemaPlan.ts";

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
	if (version < pgBossPackage.pgboss.schema) {
		const partitionTables: MigrationPartition[] = Array.from(
			await run(connection.executeUnprepared(`SELECT table_name AS "tableName", policy FROM ${schema}.queue WHERE partition = true`, [], undefined)),
		);
		await runSchemaPlan(connection, getMigrationPlans(schema, version, { partitionTables }), run);
	}
}

export function installPgBossSchema(options: PgBossSchemaOptions = {}): Effect.Effect<void, PgBossError, SqlClient.SqlClient> {
	return Effect.scoped(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const connection = yield* sql.reserve;
			const run = Effect.runPromiseWith(yield* Effect.context<never>());
			yield* Effect.tryPromise({ catch: (error) => error, try: () => installSchema(connection, options, run) });
		}).pipe(Effect.mapError((error) => toPgBossError("install", error))),
	).pipe(Effect.uninterruptible);
}
