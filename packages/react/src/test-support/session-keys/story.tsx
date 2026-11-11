import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "#test/Screen.ts";
import type { Backend, Person } from "#test/session-keys/preferences.ts";
import { TwoSessions } from "#test/session-keys/TwoSessions.tsx";
import { settleScreen } from "#test/settleScreen.ts";

interface SessionKeysEngine {
	readonly backend: Backend;
	readonly runtime: Atom.RuntimeFactory;
	readonly screen: Screen;
	view?: Rendered;
}

function opened(engine: SessionKeysEngine) {
	if (engine.view === undefined) {
		throw new Error("No sessions are open");
	}
	return engine.view;
}

function settle(engine: SessionKeysEngine) {
	const { container } = opened(engine);
	return settleScreen(container, () => container.querySelector('output[data-pending="true"]') !== null, engine.screen.tell);
}

function section(engine: SessionKeysEngine, person: Person) {
	return engine.screen.driver(opened(engine).container).within({ name: person, role: "region" });
}

export const sessionKeys = storyKit({
	clock: "test",
	*create() {
		const clock = yield* Clock.Clock;
		const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
		runtime.addGlobalLayer(Layer.succeed(Clock.Clock, clock));
		const engine: SessionKeysEngine = {
			backend: {
				reads: [],
				titles: new Map([
					["alice", "Alice"],
					["bob", "Bob"],
				]),
			},
			runtime,
			screen: new Screen(() => undefined),
		};
		return engine;
	},
	inspect: ({ backend, view }) => ({ html: view?.container.innerHTML, reads: backend.reads }),
	name: "session-scoped bindings in one page",
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		return {
			reads: (person: Person) => Effect.sync(() => engine.backend.reads.filter((reader) => reader === person).length),
			save: (person: Person, title: string) => {
				const driver = section(engine, person);
				return driver
					.enter({ name: "Title", role: "textbox" }, title)
					.pipe(Effect.andThen(driver.click({ name: "Save", role: "button" })), Effect.andThen(settle(engine)));
			},
			shown: (person: Person) =>
				Effect.sync(() => opened(engine).container.querySelector(`section[aria-label="${person}"] output`)?.textContent ?? "no preferences"),
		};
	},
});

export function sessionsSharingOneRuntime() {
	return sessionKeys.trait(
		"screen",
		"alice and bob each show their preferences through their own session registry, and both registries share one page runtime and its Reactivity",
		function* (engine) {
			engine.view = yield* engine.screen.open(<TwoSessions backend={engine.backend} runtime={engine.runtime} />);
			yield* settle(engine);
		},
	);
}
