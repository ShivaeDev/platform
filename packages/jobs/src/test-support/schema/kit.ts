import { Clock, Context, Effect, Fiber, Layer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { assertPostgresMigrations } from "@shivaedev/sql/assertPostgresMigrations.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { PostgresTestDatabase, type PostgresTestServices } from "@shivaedev/test-sql/server/database.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { installPgBossSchema, pgBossSchema } from "#server/schema.ts";
import { type DatabaseEngine, databaseEngine } from "#test/postgres/databaseEngine.ts";
import { postgresConfigured, postgresLayer } from "#test/postgres/layer.ts";
import { listingVerbs } from "#test/postgres/listingVerbs.ts";
import { readouts } from "#test/postgres/readouts.ts";
import { answer, runtimeVerbs } from "#test/postgres/verbs.ts";
import { waitingVerbs } from "#test/postgres/waitingVerbs.ts";
import { deferralVerbs } from "./deferralVerbs.ts";

export interface SchemaState {
	engine: DatabaseEngine;
	installation: Fiber.Fiber<void> | undefined;
	services: Context.Context<PostgresTestServices | PostgresTestDatabase>;
	snapshot: Effect.Effect<void> | undefined;
}

type Tell = (line: string) => void;

export function engineFor(services: SchemaState["services"], now: number) {
	return databaseEngine(Context.get(services, PostgresTestDatabase).url, Context.get(services, SqlClient.SqlClient), now);
}

interface IndexRow {
	readonly index: string;
	readonly table: string;
	readonly valid: boolean;
}

function schemaVerbs(state: SchemaState, tell: Tell) {
	function provided<A, E>(effect: Effect.Effect<A, E, PostgresTestServices>) {
		return Effect.provideContext(effect, state.services);
	}
	const sql = Context.get(state.services, SqlClient.SqlClient);
	return {
		cancelBlockedIndexBuild: () => {
			tell("the operator cancels the index build once it waits for the held snapshot");
			return Effect.gen(function* () {
				const builds = yield* observeUntil(
					sql<{ pid: number }>`SELECT pid FROM pg_stat_progress_create_index
						WHERE datid = (SELECT oid FROM pg_database WHERE datname = current_database()) AND phase = 'waiting for old snapshots'`,
					(rows) => rows.length === 1,
					"the concurrent index build waiting for the held snapshot",
					{ stableReads: 1 },
				);
				for (const { pid } of builds) {
					yield* sql`SELECT pg_cancel_backend(${pid})`;
				}
			});
		},
		checkSchema: (schema = "pgboss") => {
			tell(`the migration check inspects the ${schema} schema`);
			return answer(state.engine, provided(assertPostgresMigrations({ components: [pgBossSchema({ schema })], loader: Migrator.fromRecord({}) })));
		},
		indexes: (schema: string, pattern: string) =>
			sql<IndexRow>`SELECT indexrelid::regclass::text AS index, indrelid::regclass::text AS table, indisvalid AS valid
				FROM pg_index JOIN pg_class ON pg_class.oid = indexrelid JOIN pg_namespace ON pg_namespace.oid = relnamespace
				WHERE nspname = ${schema} AND relname ~ ${pattern} ORDER BY indexrelid::regclass::text`.withoutTransform.pipe(
				Effect.map((rows) =>
					rows
						.map(({ index, table, valid }) => ({
							index: index.replace(/\.j[a-f0-9]+_/u, ".partition_"),
							table: table.replace(/\.j[a-f0-9]+$/u, ".partition"),
							valid,
						}))
						.sort((left, right) => left.index.localeCompare(right.index)),
				),
			),
		installationFinishes: () =>
			Effect.suspend(() =>
				state.installation === undefined ? Effect.die(new Error("No schema installation started")) : Fiber.join(state.installation),
			),
		installSchema: (schema = "pgboss") => {
			tell(`the jobs schema is installed into ${schema}`);
			return answer(state.engine, provided(installPgBossSchema({ schema })));
		},
		migrateSchema: (schema = "pgboss") => {
			tell(`the application migrations apply the ${schema} schema component`);
			return answer(
				state.engine,
				provided(migratePostgres({ components: [pgBossSchema({ schema })], loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" })),
			);
		},
		releaseSnapshot: () => {
			tell("the open snapshot ends");
			return Effect.suspend(() => state.snapshot ?? Effect.die(new Error("No snapshot is held")));
		},
		schemaVersion: (schema: string) =>
			sql<{ version: number }>`SELECT version FROM ${sql(schema)}.version`.withoutTransform.pipe(
				Effect.map(([row]) => row?.version ?? "missing"),
				Effect.orElseSucceed(() => "missing"),
			),
		startInstallingSchema: (schema: string) => {
			tell(`the jobs schema starts installing into ${schema}`);
			return Effect.gen(function* () {
				state.installation = yield* answer(state.engine, provided(installPgBossSchema({ schema }))).pipe(Effect.forkScoped);
			});
		},
		storedRows: (schema: string, table: "instance" | "queue" | "schedule") =>
			sql<{ count: number }>`SELECT count(*)::int AS count FROM ${sql(schema)}.${sql(table)}`.withoutTransform.pipe(
				Effect.map(([row]) => row?.count ?? 0),
			),
	};
}

export const schemaKit = storyKit({
	clock: "test",
	*create() {
		const context = yield* Layer.build(postgresLayer);
		const services = yield* Context.get(context, PostgresTestDatabase).isolated;
		const state: SchemaState = {
			engine: engineFor(services, yield* Clock.currentTimeMillis),
			installation: undefined,
			services,
			snapshot: undefined,
		};
		return state;
	},
	inspect: ({ engine }) => ({ logs: engine.logs, startups: [...engine.startups] }),
	name: "the jobs schema over a real PostgreSQL database",
	runIf: postgresConfigured,
	stages: ["database", "runtime", "jobs", "afterwards"],
	verbs: (state, story) => ({
		...runtimeVerbs(state.engine, story.tell),
		...waitingVerbs(state.engine, story.tell),
		...readouts(state.engine),
		...listingVerbs(state.engine, story.tell),
		...schemaVerbs(state, story.tell),
		...deferralVerbs(state, story.tell),
	}),
});
