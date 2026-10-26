import { Config, Effect, Redacted } from "effect";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createEngine } from "./engine.ts";
import { openScreen } from "./openScreen.tsx";
import { migrations } from "./repository.ts";
import { verbs } from "./verbs.ts";

const configured = Effect.runSync(Config.String("PLATFORM_SQL_TEST_DATABASE_URL").pipe(Config.option));
export const settingsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => createEngine,
	inspect: ({ screen }) => screen.inspect(),
	layer: makePostgresTestLayer({
		migrations: { ...migrations, lockTimeout: "5 seconds" },
		url: Redacted.make(configured._tag === "Some" ? configured.value : "postgresql://disabled"),
	}),
	name: "entity settings",
	runIf: configured._tag === "Some",
	stages: ["commit", "editors"],
	verbs: (engine, story) => verbs(engine, story.tell),
});
export function editors(...names: Array<"writer" | "reader" | "bob">) {
	return settingsStory.trait("editors", `${names.join(" and ")} have open settings`, function* (engine) {
		for (const name of names) {
			const bob = name === "bob";
			const view = yield* openScreen(engine.screen, engine.url, bob ? "bob-session" : "alice-session", bob ? 2 : 1, engine.screen.tell);
			engine.screens.set(name, view);
		}
	});
}

export function commitIsHeld() {
	return settingsStory.trait("commit", "the first settings transaction waits before commit", (engine) => {
		engine.gate.held = true;
	});
}
