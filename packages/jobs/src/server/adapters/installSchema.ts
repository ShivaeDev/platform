import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Connection } from "effect/sql/SqlConnection";
import { getConstructionPlans, getMigrationPlans, PgBoss } from "pg-boss";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import { jobStorePlans } from "#internal/jobStorePlans.ts";
import type { PgBossSchemaOptions } from "#schema.ts";
import { runSchemaPlan } from "./runSchemaPlan.ts";
import { resumeSchemaIndexes } from "./schemaIndexBuilds.ts";

const Partitions = Schema.Array(
	Schema.Struct({
		policy: Schema.String,
		tableName: Schema.String,
	}),
);
async function installNativeSchema(
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

export const installSchema = Effect.fnUntraced(function* (options: PgBossSchemaOptions) {
	const sql = yield* SqlClient.SqlClient;
	const connection = yield* sql.reserve;
	const run = Effect.runPromiseWith(yield* Effect.context<never>());
	yield* Effect.tryPromise({
		catch: (error) => error,
		try: async (signal) => {
			const execute: typeof run = (effect) => run(effect, { signal });
			await installNativeSchema(connection, options, execute);
		},
	});
	for (const plan of jobStorePlans(options.schema ?? "pgboss")) {
		yield* connection.executeRaw(plan, []);
	}
});
