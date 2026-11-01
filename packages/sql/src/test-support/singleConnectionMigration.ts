import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { migratePostgres } from "#migrations.ts";
import { postgresLayer } from "#postgresLayer.ts";
import { loaderOf, type Migration } from "./migrationCatalog.ts";
import type { MigrationEngine } from "./migrationEngine.ts";
import { postgresOptions } from "./postgres.ts";

export const singleConnectionMigration = Effect.fnUntraced(function* (engine: MigrationEngine, migrations: readonly Migration[]) {
	const context = yield* Layer.build(postgresLayer(postgresOptions.url, { ...postgresOptions, maxConnections: 1 }));
	const sql = Context.get(context, SqlClient.SqlClient);
	const applied = yield* migratePostgres({
		loader: loaderOf({ ...engine, sql }, migrations),
		lockTimeout: "5 seconds",
		table: engine.tables.ledger,
	}).pipe(Effect.provideContext(context));
	engine.runs.push(applied);
});
