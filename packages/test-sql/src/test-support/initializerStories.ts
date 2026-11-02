import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { CloneStory, tableNames } from "./cloneStory.ts";
import { type InitializerSource, initializerLayer } from "./initializerLayer.ts";
import { configured } from "./postgres.ts";

const appState = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from app_state`;
	return rows.map(({ value }) => value);
});

function initializerKit(source: InitializerSource) {
	const { layer, preparation } = initializerLayer(source);
	return storyKit({
		after: { database: (engine) => engine.acquire() },
		clock: "live",
		create: () => new CloneStory(),
		inspect: (engine) => ({ preparation, template: engine.template }),
		layer,
		name: `initializer through ${source}`,
		runIf: configured,
		stages: ["database"],
		verbs: (engine, story) => ({
			appState: () => {
				story.tell("the story reads the initialized application state");
				return engine.run(appState);
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
				return engine.run(tableNames);
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
		engine.template = "empty";
	},
);
