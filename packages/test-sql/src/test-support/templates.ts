import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { PostgresTestTemplate } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { CloneStory, tableNames } from "./cloneStory.ts";
import { configured } from "./postgres.ts";
import { preparation, templateLayer } from "./templateLayer.ts";

const items = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from items order by id`;
	return rows.map(({ value }) => value);
});

export const templates = storyKit({
	after: { database: (engine) => engine.acquire() },
	clock: "live",
	create: () => new CloneStory(),
	inspect: (engine) => ({ preparation, template: engine.template }),
	layer: templateLayer,
	name: "database templates",
	runIf: configured,
	stages: ["database"],
	verbs: (engine, story) => ({
		appliedMigrations: () =>
			engine.run(
				Effect.flatMap(SqlClient.SqlClient, (sql) =>
					Effect.map(sql<{ id: number }>`select migration_id as id from effect_sql_migrations`, (rows) => rows.map(({ id }) => id)),
				),
			),
		changeItem: (value: string) => {
			story.tell(`the story commits the item "${value}" in its database`);
			return engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`));
		},
		items: () => engine.run(items),
		itemsInNewClone: () => engine.run(withIsolatedDatabase(items)),
		loaderResources: () => Effect.sync(() => (preparation.released > 0 ? "released" : "still open")),
		loaderRows: () =>
			engine.run(
				Effect.flatMap(SqlClient.SqlClient, (sql) =>
					Effect.map(sql<{ template: string }>`select template from app_options_fixture`, (rows) =>
						rows.map(({ template }) => (template === preparation.template ? "written in the migrated template" : `written in ${template}`)),
					),
				),
			),
		preparationRuns: () => Effect.sync(() => ({ ...preparation.counts, loaders: preparation.loaders })),
		tables: () => engine.run(tableNames),
		tablesInNewClone: (template: PostgresTestTemplate) => engine.run(withIsolatedDatabase(tableNames, { template })),
	}),
});

export const emptyDatabase = templates.trait("database", "the story starts before the first deployment, from the empty template", (engine) => {
	engine.template = "empty";
});
