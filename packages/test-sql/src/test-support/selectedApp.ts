import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase, type PostgresTestTemplate } from "#server/database.ts";
import { storyDatabase } from "#server/storyDatabase.ts";
import { configured, secondClient, setup } from "./postgres.ts";

export interface AppObservation {
	clients?: { readonly pg: readonly string[]; readonly sql: readonly string[] };
	closed?: readonly string[];
	readonly database: string;
	readonly tables: readonly string[];
}

declare module "vitest" {
	interface TaskMeta {
		selectedDatabase?: AppObservation;
	}
}

function tables(sql: SqlClient.SqlClient) {
	return sql<{ name: string }>`select table_name as name from information_schema.tables where table_schema = 'public' order by table_name`.pipe(
		Effect.map((rows) => rows.map(({ name }) => name)),
	);
}

const startApp = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const sql = yield* secondClient(database.url);
	const observation: AppObservation = {
		database: new URL(Redacted.value(database.url)).pathname.slice(1),
		tables: yield* tables(sql),
	};
	yield* Effect.addFinalizer(() =>
		tables(sql).pipe(
			Effect.orDie,
			Effect.tap((names) =>
				Effect.sync(() => {
					observation.closed = names;
				}),
			),
		),
	);
	return { observation, tables: () => tables(sql) };
});

class App extends Context.Service<App, Effect.Success<typeof startApp>>()("@shivaedev/test-sql/SelectedApp") {}

export function selectedApp(template?: PostgresTestTemplate) {
	return storyKit({
		after: {
			app: () => Layer.build(Layer.effect(App, startApp)),
			database: (database) => database.acquire,
		},
		clock: "test",
		create: () => storyDatabase(template === undefined ? undefined : { template }),
		inspect: () => Effect.flatMap(App, (app) => app.tables()),
		layer: setup().layer,
		name: `selected ${template ?? "migrated"} database`,
		runIf: configured,
		stages: ["database", "app", "ready"],
		verbs: (_engine, story) => ({
			observeStartup: () => {
				story.tell("the app reports the database and tables it opened at startup");
				return Effect.map(App, (app) => app.observation);
			},
			stopWithFailure: () => {
				story.tell("the story fails after the app starts");
				return Effect.fail("the app story failed on purpose");
			},
			tables: () => {
				story.tell("the story reads its current SQL client's tables");
				return Effect.flatMap(SqlClient.SqlClient, tables);
			},
			tablesThroughPg: () => {
				story.tell("the story reads its native PostgreSQL client's tables");
				return Effect.flatMap(PgClient.PgClient, tables);
			},
		}),
	});
}

export const migratedApp = selectedApp();
export const emptyApp = selectedApp("empty");
export const empty = migratedApp.trait("database", "the app starts from an empty database", (database) => database.select("empty"));
export const migrated = emptyApp.trait("database", "the app starts from the migrated database", (database) => database.select("migrated"));

export const storyTable = migratedApp.trait("ready", "the running app's database receives a story table", () =>
	Effect.flatMap(SqlClient.SqlClient, (sql) => sql`create table story_note (value text)`).pipe(Effect.asVoid),
);
