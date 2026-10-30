import { Context, Effect, Layer, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { assertPostgresMigrations } from "@shivaedev/sql/assertPostgresMigrations.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { PostgresTestDatabase, type PostgresTestServices } from "@shivaedev/test-sql/server/database.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { installPgBossSchema, pgBossSchema } from "#schema.ts";
import { type DatabaseEngine, databaseEngine } from "#test/postgres/databaseEngine.ts";
import { postgresConfigured, postgresLayer } from "#test/postgres/layer.ts";
import { readouts } from "#test/postgres/readouts.ts";
import { answer, runtimeVerbs, waitingVerbs } from "#test/postgres/verbs.ts";

export interface SchemaState {
	engine: DatabaseEngine;
	services: Context.Context<PostgresTestServices | PostgresTestDatabase>;
	snapshot: Effect.Effect<void> | undefined;
}

type Tell = (line: string) => void;

export function engineFor(services: SchemaState["services"]) {
	return databaseEngine(Redacted.value(Context.get(services, PostgresTestDatabase).url), Context.get(services, SqlClient.SqlClient));
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
		storedRows: (schema: string, table: "instance" | "queue" | "schedule") =>
			sql<{ count: number }>`SELECT count(*)::int AS count FROM ${sql(schema)}.${sql(table)}`.withoutTransform.pipe(
				Effect.map(([row]) => row?.count ?? 0),
			),
	};
}

export const schemaKit = storyKit({
	clock: "live",
	*create() {
		const context = yield* Layer.build(postgresLayer);
		const services = yield* Context.get(context, PostgresTestDatabase).isolated;
		const state: SchemaState = { engine: engineFor(services), services, snapshot: undefined };
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
		...schemaVerbs(state, story.tell),
	}),
});
