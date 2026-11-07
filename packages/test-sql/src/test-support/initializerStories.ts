import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { storyDatabase } from "#server/storyDatabase.ts";
import { type InitializerSource, initializerLayer } from "#test/initializerLayer.ts";
import { configured } from "#test/postgres.ts";
import { tableNames } from "#test/tableNames.ts";

const appState = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from app_state`;
	return rows.map(({ value }) => value);
});

function initializerKit(source: InitializerSource) {
	const { layer, preparation } = initializerLayer(source);
	return storyKit({
		after: { database: (engine) => engine.acquire },
		clock: "test",
		create: () => storyDatabase(),
		inspect: () => ({ preparation }),
		layer,
		name: `initializer through ${source}`,
		runIf: configured,
		stages: ["database"],
		verbs: (_engine, story) => ({
			appState: () => {
				story.tell("the story reads the initialized application state");
				return appState;
			},
			initializerResources: () => {
				story.tell("the story reads whether initializer resources were released");
				return Effect.sync(() => (preparation.released > 0 ? "released" : "still open"));
			},
			preparationRuns: () => {
				story.tell("the story reads how often the initializer and fixtures ran");
				return Effect.sync(() => ({ fixtures: preparation.fixtures, initializer: preparation.initializer }));
			},
			tables: () => {
				story.tell("the story reads the cloned database’s tables");
				return tableNames;
			},
		}),
	});
}

export const urlInitializer = initializerKit("the template URL");
export const clientInitializer = initializerKit("the supplied client");
export const firstDeployment = urlInitializer.trait(
	"database",
	"the app has never been deployed, so the story starts from the empty template",
	(engine) => {
		engine.select("empty");
	},
);
