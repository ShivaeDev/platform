import process from "node:process";
import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer, Redacted } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql";
import type { SchemaComponent } from "@shivaedev/effect-sql/SchemaComponent.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { environmentVariable } from "#test/environmentVariable.ts";
import { bootMigrations } from "./bootMigrations.ts";
import { migrationLoader } from "./migrationLoader.ts";

const create = Effect.fnUntraced(function* () {
	const url = yield* Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
	const table = `waiting_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${table}_migrations`;
	const sql = yield* SqlClient.SqlClient;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`.pipe(Effect.orDie));
	const lifecycle: string[] = [];
	const components: SchemaComponent[] = [];
	return { lifecycle, migrations: { components, loader: migrationLoader(table), table: ledger }, table, url };
});

export type MigrationState = Effect.Success<ReturnType<typeof create>>;

export const migrationHost = storyKit({
	clock: "test",
	create,
	layer: Layer.unwrap(Effect.map(Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL"), (url) => PgClient.layer({ url }))),
	name: "migration wait",
	runIf: environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL") !== undefined,
	stages: ["schema"],
	verbs: (state, story) => ({
		connections: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const [row] = yield* sql<{ count: number }>`select count(*)::int as count from pg_stat_activity where application_name = ${state.table}`;
				if (row === undefined) {
					throw new Error("The database did not return a connection count");
				}
				return row.count;
			}),
		lifecycle: () => state.lifecycle,
		migrate: (initialOnly = false) =>
			Effect.gen(function* () {
				story.tell(`a separate process applies ${initialOnly ? "the initial migration" : "all migrations"}`);
				const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
				const env = {
					"DATABASE_URL": Redacted.value(state.url),
					"HOST_JOBS_SCHEMA": state.migrations.components.length > 0 ? `${state.table}_jobs` : "",
					"HOST_MIGRATION_TABLE": state.table,
				};
				const child = yield* spawner.spawn(
					ChildProcess.make(
						process.execPath,
						["--conditions=source", fileURLToPath(new URL("./migrationProcess.ts", import.meta.url)), initialOnly ? "initial" : "all"],
						{ env, extendEnv: true, stderr: "inherit" },
					),
				);
				return yield* child.exitCode;
			}).pipe(Effect.provide(NodeServices.layer)),
		start: (options?: Parameters<typeof bootMigrations>[1]) => {
			story.tell(`the host starts in ${options?.mode ?? "wait"} mode`);
			return bootMigrations(state, options);
		},
	}),
});

export const invalidLedger = migrationHost.trait("schema", "the ledger is missing its name column", function* (state) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table ${sql(state.migrations.table)} (migration_id integer primary key)`;
});
