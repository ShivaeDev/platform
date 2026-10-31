import { Config, Effect, Redacted } from "effect";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createEngine, type Engine } from "./engine.ts";
import { openScreen } from "./openScreen.tsx";
import { migrations } from "./repository.ts";
import { editorVerbs, verbs } from "./verbs.ts";

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
	stages: ["editors"],
	verbs: (engine, story) => verbs(engine, story.tell),
});

type Editor = "writer" | "reader" | "bob";

function* open(engine: Engine, names: readonly Editor[]) {
	for (const name of names) {
		const bob = name === "bob";
		const view = yield* openScreen(engine.screen, engine.url, bob ? "bob-session" : "alice-session", bob ? 2 : 1, engine.screen.tell);
		engine.screens.set(name, view);
		yield* view.driver.settle();
	}
}

const who = { bob: "bob's editor for his entity 2", reader: "alice's second editor for entity 1", writer: "alice's editor for her entity 1" };

export function editorsOpen(...names: Editor[]) {
	return settingsStory.trait("editors", `${names.map((name) => who[name]).join(" and ")} open on live settings`, (engine) => open(engine, names));
}

export function firstSaveWaitingAtCommit() {
	return settingsStory.trait(
		"editors",
		"alice's writer and reader editors are open, and the writer's save of Alice's table / 50 waits before its commit",
		function* (engine) {
			engine.gate.held = true;
			yield* open(engine, ["writer", "reader"]);
			const { edit, saveUntilCommitWaits } = editorVerbs(engine);
			yield* edit("writer", "title", "Alice's table");
			yield* edit("writer", "pageSize", "50");
			yield* saveUntilCommitWaits("writer");
		},
	);
}

export function firstSaveDelivered() {
	return settingsStory.trait("editors", "alice's writer saved Alice's table / 50 and her reader editor shows it", function* (engine) {
		yield* open(engine, ["writer", "reader"]);
		const { edit, save } = editorVerbs(engine);
		yield* edit("writer", "title", "Alice's table");
		yield* edit("writer", "pageSize", "50");
		yield* save("writer");
	});
}

export function aliceSaved() {
	return settingsStory.trait("editors", "alice's and bob's editors are open, and alice saved Alice only / 25", function* (engine) {
		yield* open(engine, ["writer", "bob"]);
		const { edit, save } = editorVerbs(engine);
		yield* edit("writer", "title", "Alice only");
		yield* save("writer");
	});
}
