import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { getConstructionPlans, getMigrationPlans, PgBoss } from "pg-boss";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import { jobStorePlans } from "#server/jobStorePlans.ts";
import { SchemaConnection } from "#server/SchemaConnection.ts";
import type { PgBossSchemaOptions } from "#server/schema.ts";
import { runSchemaPlan } from "./runSchemaPlan.ts";
import { resumeSchemaIndexes } from "./schemaIndexBuilds.ts";

const Partitions = Schema.Array(
	Schema.Struct({
		policy: Schema.String,
		tableName: Schema.String,
	}),
);

export const installSchema = Effect.fnUntraced(function* (options: PgBossSchemaOptions) {
	const sql = yield* SqlClient.SqlClient;
	const connection = yield* sql.reserve;
	async function installNativeSchema(execute: <A, E>(effect: Effect.Effect<A, E>) => Promise<A>): Promise<void> {
		const schema = options.schema ?? "pgboss";
		const construction = getConstructionPlans(schema);
		const client = new PgBoss({
			db: { executeSql: async (text, values = []) => ({ rows: Array.from(await execute(connection.executeUnprepared(text, values, undefined))) }) },
			schema,
		});
		if (!(await client.isInstalled())) {
			await execute(runSchemaPlan(construction).pipe(Effect.provideService(SchemaConnection, connection)));
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
				await execute(
					connection.executeUnprepared(`SELECT table_name AS "tableName", policy FROM ${schema}.queue WHERE partition = true`, [], undefined),
				),
			);
			await execute(
				runSchemaPlan(getMigrationPlans(schema, version, { partitionTables: Array.from(partitionTables) }), {
					schema,
					version: pgBossPackage.pgboss.schema,
				}).pipe(Effect.provideService(SchemaConnection, connection)),
			);
			await resumeSchemaIndexes(client, schema);
		}
	}

	const run = Effect.runPromiseWith(yield* Effect.context<never>());
	yield* Effect.tryPromise({
		catch: (error) => error,
		try: async (signal) => {
			const execute: typeof run = (effect) => run(effect, { signal });
			await installNativeSchema(execute);
		},
	});
	for (const plan of jobStorePlans(options.schema ?? "pgboss")) {
		yield* connection.executeRaw(plan, []);
	}
});
