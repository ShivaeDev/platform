import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { PostgresTestTemplate } from "#database.ts";
import { storyDatabase } from "#storyDatabase.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { configured } from "./postgres.ts";
import { tableNames } from "./tableNames.ts";
import { preparation, templateLayer } from "./templateLayer.ts";

const items = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from items order by id`;
	return rows.map(({ value }) => value);
});

export const templates = storyKit({
	after: { database: (engine) => engine.acquire },
	clock: "live",
	create: () => storyDatabase(),
	inspect: () => ({ preparation }),
	layer: templateLayer,
	name: "database templates",
	runIf: configured,
	stages: ["database"],
	verbs: (_engine, story) => ({
		appliedMigrations: () => {
			story.tell("the story reads its database’s migration ledger");
			return Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ id: number }>`select migration_id as id from effect_sql_migrations`, (rows) => rows.map(({ id }) => id)),
			);
		},
		changeItem: (value: string) => {
			story.tell(`the story commits the item "${value}" in its database`);
			return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`);
		},
		items: () => {
			story.tell("the story reads its database’s items");
			return items;
		},
		itemsInNewClone: () => {
			story.tell("the story opens a new migrated clone and reads its items");
			return withIsolatedDatabase(items);
		},
		loaderResources: () => {
			story.tell("the story reads whether migration loader resources were released");
			return Effect.sync(() => (preparation.released > 0 ? "released" : "still open"));
		},
		loaderRows: () => {
			story.tell("the story reads the rows written by the migration loader");
			return Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ template: string }>`select template from app_options_fixture`, (rows) =>
					rows.map(({ template }) => (template === preparation.template ? "written in the migrated template" : `written in ${template}`)),
				),
			);
		},
		preparationRuns: () => {
			story.tell("the story reads how often migrations, fixtures and loaders ran");
			return Effect.sync(() => ({ ...preparation.counts, loaders: preparation.loaders }));
		},
		tables: () => {
			story.tell("the story reads its database’s tables");
			return tableNames;
		},
		tablesInNewClone: (template: PostgresTestTemplate) => {
			story.tell(`the story opens a new ${template} clone and reads its tables`);
			return withIsolatedDatabase(tableNames, { template });
		},
	}),
});

export const emptyDatabase = templates.trait("database", "the story starts before the first deployment, from the empty template", (engine) => {
	engine.select("empty");
});
