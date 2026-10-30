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
		verbs: (engine) => ({
			appState: () => engine.run(appState),
			initializerResources: () => Effect.sync(() => (preparation.released > 0 ? "released" : "still open")),
			preparationRuns: () => Effect.sync(() => ({ fixtures: preparation.fixtures, initializer: preparation.initializer })),
			tables: () => engine.run(tableNames),
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
