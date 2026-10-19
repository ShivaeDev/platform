import { Context, Effect, Layer, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { getRollbackPlans } from "pg-boss";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/server/postgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runSchemaPlan } from "#internal/runSchemaPlan.ts";
import { installPgBossSchema, type PgBossSchemaOptions } from "#schema.ts";
import { clientEngine } from "#test/clientEngine.ts";
import { holdIndexBuild } from "#test/holdIndexBuild.ts";
import { pgBossRuntime } from "#test/pgBossRuntime.ts";
import { postgresConfigured, postgresLayer } from "#test/postgresLayer.ts";
import { waitingVerbs } from "#test/waitingVerbs.ts";

export const schemaStories = storyKit({
	clock: "live",
	*create() {
		const context = yield* Layer.build(postgresLayer);
		const services = yield* Context.get(context, PostgresTestDatabase).isolated;
		return { services };
	},
	name: "pg-boss schema installation",
	stages: ["database"],
	verbs: (state, story) => {
		const runtime = pgBossRuntime(
			{
				...clientEngine(),
				connectionString: Redacted.value(Context.get(state.services, PostgresTestDatabase).url),
				factory: undefined,
			},
			story.tell,
		);
		const sql = Context.get(state.services, SqlClient.SqlClient);
		return {
			...runtime,
			...waitingVerbs(),
			holdIndexBuild: () => holdIndexBuild(sql),
			installSchema: (options?: PgBossSchemaOptions) => installPgBossSchema(options).pipe(Effect.provideContext(state.services)),
			query: <A extends object>(text: string) => sql.unsafe<A>(text),
			rollbackSchema: (schema: string, version: number) =>
				Effect.scoped(
					Effect.gen(function* () {
						const connection = yield* sql.reserve;
						yield* Effect.promise(() => runSchemaPlan(connection, getRollbackPlans(schema, version), Effect.runPromise));
					}),
				),
		};
	},
});

export const schemaIt = schemaStories.it.runIf(postgresConfigured);

export const installedTemplate = schemaStories.trait("database", "a template fixture installs the jobs schema before cloning", function* (state) {
	const template = yield* Layer.build(
		makePostgresTestLayer({
			fixtures: installPgBossSchema({ schema: "jobs_test" }),
			migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
			url: Context.get(state.services, PostgresTestDatabase).url,
		}),
	);
	state.services = yield* Context.get(template, PostgresTestDatabase).isolated;
});
