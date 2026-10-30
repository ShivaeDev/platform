import { Context, Effect, Layer, type Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { getRollbackPlans, PgBoss } from "pg-boss";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import type { QueueDefinition } from "#definition.ts";
import { installPgBossSchema } from "#schema.ts";
import type { StoryPayload } from "#test/postgres/databaseEngine.ts";
import { type StartOptions, startRuntime } from "#test/postgres/engine.ts";
import { enqueueAs } from "#test/postgres/verbs.ts";
import type { Registration } from "#test/workers.ts";
import { engineFor, schemaKit } from "./kit.ts";

export const installedTemplate = schemaKit.trait(
	"database",
	"a template fixture installed the jobs schema into jobs_test before the database was cloned",
	function* (state) {
		const template = yield* Layer.build(
			makePostgresTestLayer({
				fixtures: installPgBossSchema({ schema: "jobs_test" }),
				migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
				url: Context.get(state.services, PostgresTestDatabase).url,
			}),
		);
		state.services = yield* Context.get(template, PostgresTestDatabase).isolated;
		state.engine = engineFor(state.services);
	},
);

export function installed(schema = "pgboss") {
	return schemaKit.trait("database", `the jobs schema is installed into ${schema}`, (state) =>
		installPgBossSchema({ schema }).pipe(Effect.provideContext(state.services)),
	);
}

export function brokenSchema(schema: string) {
	return schemaKit.trait("database", `${schema} holds only a version table at version 44`, (state) => {
		const sql = Context.get(state.services, SqlClient.SqlClient);
		return Effect.all(
			[
				sql.unsafe(`CREATE SCHEMA ${schema}`),
				sql.unsafe(`CREATE TABLE ${schema}.version (version int)`),
				sql.unsafe(`INSERT INTO ${schema}.version VALUES (44)`),
			],
			{ discard: true },
		);
	});
}

export function ran(name: string, jobs: readonly Registration[], options: StartOptions) {
	return schemaKit.trait("runtime", `${name} ran the jobs runtime`, (state) => startRuntime(state.engine, name, jobs, options));
}

export function stopped(name: string) {
	return schemaKit.trait("afterwards", `${name} has stopped`, (state) =>
		Effect.suspend(() => {
			const runtime = state.engine.runtimes.get(name);
			state.engine.runtimes.delete(name);
			return runtime === undefined ? Effect.die(new Error(`${name} never started`)) : runtime.stop;
		}),
	);
}

export function rolledBackTo(schema: string, version: number) {
	return schemaKit.trait("afterwards", `the ${schema} schema was rolled back to version ${version}`, (state) =>
		Effect.acquireUseRelease(
			Effect.sync(() => new PgBoss({ connectionString: state.engine.url, migrate: false, schedule: false, schema, supervise: false })),
			(client) =>
				Effect.promise(async () => {
					await client.start();
					await client.getDb().executeSql(getRollbackPlans(schema, version + 1));
				}),
			(client) => Effect.promise(() => client.stop()),
		),
	);
}

export const snapshotHeld = schemaKit.trait(
	"afterwards",
	"an open snapshot holds back concurrent index builds, and lock waits on the database give up after a second",
	function* (state) {
		const sql = Context.get(state.services, SqlClient.SqlClient);
		const connection = yield* sql.reserve;
		yield* connection.executeRaw("DO $$ BEGIN EXECUTE format('ALTER DATABASE %I SET lock_timeout = %L', current_database(), '1s'); END $$", []);
		yield* connection.executeRaw("BEGIN ISOLATION LEVEL REPEATABLE READ", []);
		yield* connection.executeRaw("SELECT txid_current()", []);
		const release = connection.executeRaw("ROLLBACK", []).pipe(Effect.orDie, Effect.asVoid);
		yield* Effect.addFinalizer(() => release);
		state.snapshot = release;
	},
);

export function enqueuedBy<const TPayload extends StoryPayload>(
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	as: string,
	name: string,
) {
	return schemaKit.trait("jobs", `${name} enqueued ${as}`, (state) => enqueueAs(state.engine, name, queue, payload, { as }));
}
