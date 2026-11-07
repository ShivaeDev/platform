import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgres } from "#test/postgres.ts";
import { settingsEngine } from "#test/postgres-settings/engine.ts";

export const postgresSettings = storyKit({
	around: withIsolatedDatabase,
	create: settingsEngine,
	inspect: (engine) => ({ settings: engine.state.settings }),
	layer: postgres,
	name: "PostgreSQL settings on app start",
	stages: ["configured"],
	verbs: (engine, story) => ({
		liveSetting: (name: string) => Effect.map(engine.read(name), (rows) => rows[0]),
		start: () => {
			story.tell("the app builds its database and runs its startup migrations");
			return engine.start();
		},
	}),
});

export const declaredSetting = postgresSettings.trait("configured", "the app declares a different log_min_duration_sample", function* (engine) {
	const [current] = yield* engine.read("log_min_duration_sample");
	engine.state.settings = { "log_min_duration_sample": current?.setting === "0" ? "1" : "0" };
});
