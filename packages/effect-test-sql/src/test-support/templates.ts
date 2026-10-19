import { type Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase, type PostgresTestServices, type PostgresTestTemplate } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { narrated } from "./narrated.ts";
import { configured } from "./postgres.ts";
import { preparation, templateLayer } from "./templateLayer.ts";

const schema = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	return yield* sql<{ name: string }>`select table_name as name from information_schema.tables
		where table_schema = 'public' order by table_name`;
});

class TemplateStory {
	template: PostgresTestTemplate = "migrated";
	services: Context.Context<PostgresTestServices | PostgresTestDatabase> | undefined;

	acquire() {
		const engine = this;
		return Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			engine.services = yield* database.clone(engine.template);
		});
	}

	run<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			if (this.services === undefined) {
				throw new Error("Acquire the story database before using its services.");
			}
			return effect.pipe(Effect.provideContext(this.services));
		});
	}
}

export const templates = storyKit({
	after: { database: (engine) => engine.acquire() },
	clock: "live",
	create: () => new TemplateStory(),
	inspect: (engine) => ({ template: engine.template }),
	layer: templateLayer,
	name: "database templates",
	runIf: configured,
	stages: ["database"],
	verbs: (engine, story) => ({
		changeItem: narrated(story.tell, "commit an item change", (value: string) =>
			engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`)),
		),
		readFixture: narrated(story.tell, "read the fixture loaded through the template URL", () =>
			engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql<{ template: string }>`select template from app_options_fixture`)),
		),
		readItems: narrated(story.tell, "read cloned items", () =>
			engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql<{ value: string }>`select value from items`)),
		),
		readLedger: narrated(story.tell, "read the cloned migration ledger", () =>
			engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql<{ id: number }>`select migration_id as id from effect_sql_migrations`)),
		),
		readNestedSchema: narrated(story.tell, "read a nested clone's schema", (template: PostgresTestTemplate) =>
			engine.run(withIsolatedDatabase(schema, { template })),
		),
		readPreparation: narrated(story.tell, "read preparation counts", () => Effect.sync(() => ({ ...preparation }))),
		readSchema: narrated(story.tell, "read the story's database schema", () => engine.run(schema)),
	}),
});

export const emptyDatabase = templates.trait("database", "the story starts before the first deployment", (engine) => {
	engine.template = "empty";
});
