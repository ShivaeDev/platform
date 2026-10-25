import { type Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase, type PostgresTestServices, type PostgresTestTemplate } from "#database.ts";
import { initializerLayer } from "./initializerLayer.ts";
import { configured } from "./postgres.ts";

const schema = Effect.flatMap(
	SqlClient.SqlClient,
	(sql) => sql<{ name: string }>`select table_name as name from information_schema.tables where table_schema = 'public' order by table_name`,
);

const state = Effect.flatMap(
	SqlClient.SqlClient,
	(sql) =>
		sql<{ value: string; "initialized_in": string; database: string }>`select value, initialized_in, current_database() as database from app_state`,
);

class InitializerStory {
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

function initializerKit(source: "url" | "client") {
	const { layer, preparation } = initializerLayer(source);
	return storyKit({
		after: { database: (engine) => engine.acquire() },
		clock: "live",
		create: () => new InitializerStory(),
		inspect: (engine) => ({ template: engine.template }),
		layer,
		name: `production initializer through ${source}`,
		runIf: configured,
		stages: ["database"],
		verbs: (engine) => ({
			changeState: (value: string) => engine.run(Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update app_state set value = ${value}`)),
			readPreparation: () => Effect.sync(() => ({ ...preparation })),
			readSchema: () => engine.run(schema),
			readState: () => engine.run(state),
		}),
	});
}

export const urlInitializer = initializerKit("url");
export const clientInitializer = initializerKit("client");
export const firstDeployment = urlInitializer.trait("database", "the app has never been deployed", (engine) => {
	engine.template = "empty";
});
