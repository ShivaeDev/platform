import { Effect, Fiber, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { LiveHint } from "#live.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { hintWords, streams } from "./answers.ts";
import { waited } from "./settle.ts";

export type HintServer = "the first server" | "the second server";

interface Watcher {
	readonly fiber: Fiber.Fiber<void>;
	readonly hints: Queue.Queue<LiveHint>;
	readonly server: HintServer;
}

const hintsEngine = Effect.gen(function* () {
	const reactivity = yield* Reactivity.Reactivity;
	const servers: Record<HintServer, Effect.Success<typeof makeLiveServer>> = {
		"the first server": yield* makeLiveServer,
		"the second server": yield* makeLiveServer,
	};
	return { reactivity, servers, watchers: new Map<string, Watcher>() };
});

type HintsEngine = Effect.Success<typeof hintsEngine>;

function barrierOf(name: string): Key {
	return { _tag: "Item", collection: "barrier", id: name };
}

function withoutBarrier(hint: LiveHint, barrier: string): { readonly arrived: boolean; readonly rest: LiveHint | undefined } {
	if (hint._tag === "Resync") {
		return { arrived: false, rest: hint };
	}
	const rest = hint.keys.filter((key) => !(key._tag === "Item" && key.collection === "barrier" && key.id === barrier));
	const arrived = rest.length < hint.keys.length;
	return { arrived, rest: rest.length === 0 ? undefined : { ...hint, keys: rest } };
}

function watcherOf(engine: HintsEngine, name: string) {
	const found = engine.watchers.get(name);
	if (found === undefined) {
		throw new Error(`No watcher named ${name}`);
	}
	return found;
}

function resyncOf(engine: HintsEngine, server: HintServer) {
	return Effect.map(engine.servers[server].resync, (open) => streams(open, "open"));
}

export const liveHints = storyKit({
	clock: "live",
	create: () => hintsEngine,
	inspect: ({ watchers }) => ({ watchers: [...watchers.keys()] }),
	layer: Reactivity.layer,
	name: "live hints",
	stages: ["watchers"],
	verbs: (engine, story) => ({
		close: (name: string) => {
			story.tell(`${name} closes its stream`);
			return Fiber.interrupt(watcherOf(engine, name).fiber);
		},
		heard: (name: string) =>
			Effect.gen(function* () {
				const listening = watcherOf(engine, name);
				// The server flushes in a microtask and a pending resync absorbs changes, so one passes before the barrier change.
				yield* Effect.promise(() => Promise.resolve());
				yield* engine.reactivity.invalidate(invalidationKeys([barrierOf(name)]));
				const heard: string[] = [];
				for (;;) {
					const hint = yield* waited(Queue.take(listening.hints), () => undefined);
					if (hint === undefined) {
						return heard;
					}
					const { arrived, rest } = withoutBarrier(hint, name);
					if (rest !== undefined) {
						heard.push(hintWords(rest));
					}
					if (arrived) {
						return heard;
					}
				}
			}),
		invalidate: (keys: readonly string[]) => {
			story.tell(`the server's Reactivity invalidates ${keys.join(", ")}`);
			return engine.reactivity.invalidate(keys);
		},
		nextHint: (name: string) =>
			Effect.map(
				waited(Queue.take(watcherOf(engine, name).hints), () => undefined),
				(hint) => (hint === undefined ? "nothing" : hintWords(hint)),
			),
		resync: (server: HintServer = "the first server") => {
			story.tell(`${server} resyncs its streams`);
			return resyncOf(engine, server);
		},
	}),
});

export function watcher(name: string, keys: readonly Key[], server: HintServer = "the first server") {
	return liveHints.trait("watchers", `${name} streams hints for ${keys.length} keys from ${server} and has heard its first resync`, (engine) =>
		Effect.gen(function* () {
			const hints = yield* Queue.unbounded<LiveHint>();
			const fiber = yield* engine.servers[server].stream([...keys, barrierOf(name)]).pipe(
				Stream.runForEach((hint) => Queue.offer(hints, hint)),
				Effect.forkScoped,
			);
			yield* Queue.take(hints);
			engine.watchers.set(name, { fiber, hints, server });
		}),
	);
}
