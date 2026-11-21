import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { isClientSettled } from "#clientActivity.ts";
import { untilReflected } from "#commandSignal.ts";
import { type ContractsClient, makeClient } from "#makeClient.ts";
import { answered, shown } from "#test/answers.ts";
import { type RecordClientEngine, recordClientEngine } from "#test/record-client/engine.ts";
import { Shelf } from "#test/record-client/Shelf.ts";
import { settled } from "#test/settled.ts";

// A page's client names no URL, so the page's location decides where it connects; a Node story stands the location in.
function inPage(engine: RecordClientEngine, path: string) {
	return Effect.acquireRelease(
		Effect.sync(() => Reflect.set(globalThis, "location", { href: `${engine.origin}${path}` })),
		() => Effect.sync(() => Reflect.deleteProperty(globalThis, "location")),
	);
}

function reflected<A, E>(engine: RecordClientEngine, command: Effect.Effect<A, E, ContractsClient | Reactivity.Reactivity>) {
	return answered(
		AtomRegistry.getResult(engine.registry, engine.client.runtime.atom(untilReflected(command)).pipe(Atom.setIdleTTL(0))),
		() => "reflected",
	);
}

export const recordClientStory = storyKit({
	clock: "test",
	create: () => recordClientEngine,
	name: "one client made from a record of contracts over a real host socket",
	stages: ["views"],
	verbs: (engine, story) => ({
		activity: () => Effect.map(engine.activity.current, (state) => `${state.connectionStatus}, ${isClientSettled(state) ? "settled" : "pending"}`),
		bump: () => {
			story.tell("the tab bumps the tally");
			return reflected(engine, engine.client.api.tally.bump.run());
		},
		count: () => Effect.sync(() => shown(engine.registry.get(engine.views.count), String)),
		shelve: (title: string) => {
			story.tell(`the tab shelves ${title}`);
			return reflected(engine, engine.client.api.shelf.shelve.run({ title }));
		},
		titles: () => Effect.sync(() => shown(engine.registry.get(engine.views.titles), (titles) => titles.join(", "))),
		titlesInPage: (path: string) =>
			Effect.gen(function* () {
				story.tell(`a page at ${path} opens the shelf with a client that names no URL`);
				yield* inPage(engine, path);
				const page = makeClient({ shelf: Shelf }, engine.options);
				const result = yield* settled(engine.registry, page.api.shelf.titles.query());
				return shown(result, (titles) => titles.join(", "));
			}),
	}),
});

export const watchingBoth = recordClientStory.trait("views", "the tab shows the shelf and the tally", function* (engine) {
	engine.registry.mount(engine.views.titles);
	engine.registry.mount(engine.views.count);
	yield* settled(engine.registry, engine.views.titles);
	yield* settled(engine.registry, engine.views.count);
});
