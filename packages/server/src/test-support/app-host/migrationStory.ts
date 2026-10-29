import process from "node:process";
import { fileURLToPath } from "node:url";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer, Redacted } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { SqlClient } from "effect/sql";
import { disconnectGate } from "@shivaedev/identity/test-support/disconnectGate.ts";
import { environmentVariable } from "@shivaedev/identity/test-support/environmentVariable.ts";
import type { SchemaComponent } from "@shivaedev/sql/SchemaComponent.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { bootMigrations } from "#test/app-host/bootMigrations.ts";
import { migrationLoader } from "#test/app-host/migrationLoader.ts";

const create = Effect.fnUntraced(function* () {
	const url = yield* Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL");
	const table = `waiting_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${table}_migrations`;
	const sql = yield* SqlClient.SqlClient;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`.pipe(Effect.orDie));
	const lifecycle: string[] = [];
	const components: SchemaComponent[] = [];
	return { hostUrl: url, lifecycle, migrations: { components, loader: migrationLoader(table), table: ledger }, table, url };
});

export type MigrationState = Effect.Success<ReturnType<typeof create>>;

export const migrationHost = storyKit({
	clock: "test",
	create,
	layer: Layer.unwrap(Effect.map(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL"), (url) => PgClient.layer({ url }))),
	name: "migration wait",
	runIf: environmentVariable("PLATFORM_SQL_TEST_DATABASE_URL") !== undefined,
	stages: ["schema"],
	verbs: (state, story) => ({
		connections: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				return yield* sql<{ state: string }>`select state from pg_stat_activity where application_name = ${state.table}`;
			}),
		holdDisconnects: () =>
			Effect.gen(function* () {
				story.tell("hold the host's PostgreSQL disconnect acknowledgement");
				const gate = yield* Effect.acquireRelease(
					Effect.promise(() => disconnectGate(Redacted.value(state.url))),
					(resource) => Effect.promise(resource.close),
				);
				state.hostUrl = Redacted.make(gate.url);
				return { disconnecting: Effect.promise(() => gate.disconnecting), release: Effect.sync(gate.release) };
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
