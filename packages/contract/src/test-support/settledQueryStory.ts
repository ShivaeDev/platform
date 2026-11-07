import { Deferred, Effect, Exit, Scope } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { type SettledQueries, settledQueries } from "@shivaedev/test-kits/contract/settledQueries.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { shown } from "#test/answers.ts";
import { completionEngine, records } from "#test/completionEngine.ts";

interface Watcher {
	readonly results: SettledQueries<string, unknown>;
	readonly scope: Scope.Closeable;
}

export const settledQueryStory = storyKit({
	*create() {
		return { ...(yield* completionEngine), watchers: new Map<string, Watcher>() };
	},
	name: "scoped settled query readouts",
	stages: ["server"],
	verbs: (engine, story) => {
		function watcher(name: string) {
			const found = engine.watchers.get(name);
			if (found === undefined) {
				throw new Error(`No query watcher named ${name}`);
			}
			return found;
		}
		return {
			announce: (value: string) => {
				story.tell(`the server announces ${value}`);
				engine.state.value = value;
				return engine.reactivity.invalidate(invalidationKeys([records.item(1)]));
			},
			failRead: () => {
				story.tell("the server fails its next read");
				engine.state.failed = true;
				return engine.reactivity.invalidate(invalidationKeys([records.item(1)]));
			},
			latest: (name: string) => Effect.map(watcher(name).results.latest, (result) => shown(result, String)),
			next: (name: string) => Effect.map(watcher(name).results.next, (result) => shown(result, String)),
			releaseAnswer: () => {
				story.tell("the server releases its held answer");
				return Deferred.succeed(engine.answer, undefined);
			},
			requestReceived: () => Deferred.await(engine.received),
			stop: (name: string) => {
				story.tell(`close ${name}'s observation scope`);
				return Scope.close(watcher(name).scope, Exit.void);
			},
			subscribed: () => Effect.sync(() => engine.registry.ensureNode(engine.view).listeners.size > 0),
			watch: Effect.fn("SettledQueryStory.watch")(function* (name: string) {
				story.tell(`${name} watches the query in its own scope`);
				const scope = yield* Scope.fork(yield* Scope.Scope);
				const results = yield* settledQueries(engine.view).pipe(
					Effect.provideService(AtomRegistry.AtomRegistry, engine.registry),
					Effect.provideService(Scope.Scope, scope),
				);
				engine.watchers.set(name, { results, scope });
			}),
		};
	},
});

export const heldAnswer = settledQueryStory.trait("server", "the server holds its answer", ({ state }) => {
	state.held = true;
});
