import { Effect, Ref, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { liveClient } from "#test/live/client.ts";
import { eventually } from "./eventually.ts";
import { liveEngine, liveSnapshot, streamRunner } from "./liveEngine.ts";

export const liveNotesStory = storyKit({
	clock: "live",
	create: () => liveEngine,
	inspect: liveSnapshot,
	name: "live notes",
	stages: ["session", "notes", "consumer"],
	verbs: (engine, story) => {
		const { client, registry, server } = engine;
		const run = streamRunner(engine);
		return {
			active: () => Effect.runSync(Ref.get(server.active)),
			body: (atom: ReturnType<typeof client.api.get.query>) => AsyncResult.getOrElse(registry.get(atom), () => undefined)?.body,
			connect: () => {
				story.tell("subscribe to live notes");
				registry.mount(client.connection);
			},
			connections: () => Effect.runSync(Ref.get(server.connections)),
			disconnect: () => {
				story.tell("disconnect the live stream");
				return Effect.promise(server.disconnect);
			},
			dispose: () => {
				story.tell("dispose the consumer");
				registry.dispose();
			},
			edit: (id: number, body: string) => {
				story.tell(`change note ${id} to ${body}`);
				return Effect.promise(() => server.edit(id, body));
			},
			emit: (hint: Parameters<typeof server.emit>[0]) => Effect.promise(() => server.emit(hint)),
			gateReads: (gate: Effect.Effect<void>) => Ref.set(server.gate, gate),
			get: (id: number) => {
				story.tell(`read live note ${id}`);
				return run(client.api.get.run({ id }));
			},
			invalidate: (keys: Parameters<typeof server.reactivity.invalidate>[0]) => server.reactivity.invalidate(keys),
			list: client.api.list.query(undefined),
			mount: <A>(atom: Atom.Atom<A>) => registry.mount(atom),
			one: client.api.get.query({ id: 1 }),
			pause: (paused: boolean) => {
				story.tell(paused ? "pause live reads" : "resume live reads");
				registry.set(client.paused, paused);
			},
			query: (id: number) => client.api.get.query({ id }),
			queryList: () => client.api.list.query(undefined),
			readOutage: (unavailable: boolean) => Ref.set(server.unavailable, unavailable),
			reads: () => Effect.runSync(Ref.get(server.reads)),
			registry,
			resume: () => {
				story.tell("the consumer resumes");
				registry.set(client.resume, registry.get(client.resume) + 1);
			},
			resync: (helper: "first" | "second" = "first") => (helper === "first" ? server.hints : server.secondHints).resync,
			status: () => registry.get(client.status),
			streamOutage: (unavailable: boolean) => Ref.set(server.streamUnavailable, unavailable),
			subscribe: (count?: number, signal?: AbortSignal) => {
				story.tell("collect the bound live subscription");
				const stream = count === undefined ? client.api.subscribe.run(undefined) : client.api.subscribe.run(undefined).pipe(Stream.take(count));
				return run(Stream.runCollect(stream), signal);
			},
			subscriptionResult: () => {
				story.tell("read the subscription's typed result");
				return run(Effect.result(Stream.runCollect(client.api.subscribe.run(undefined))));
			},
			two: client.api.get.query({ id: 2 }),
			watch: (id: number, helper: "first" | "second", hints: unknown[]) => {
				story.tell(`watch note ${id} with the ${helper} helper`);
				return run(client.api.watch.run({ helper, id }).pipe(Stream.runForEach((hint) => Effect.sync(() => hints.push(hint)))));
			},
		};
	},
});

export function liveSession(user = "ada") {
	return liveNotesStory.trait("session", `${user} has a live session`, (engine) => Ref.set(engine.server.session, { user }));
}
export function liveDenied() {
	return liveNotesStory.trait("session", "the live session is denied", (engine) => Ref.set(engine.server.denied, true));
}
export function liveStoredNotes(...values: readonly import("./notes.ts").Note[]) {
	return liveNotesStory.trait("notes", "notes are stored on the live server", (engine) =>
		Ref.set(engine.server.stored, new Map(values.map((note) => [note.id, note]))),
	);
}
export function withoutResume() {
	return liveNotesStory.trait("consumer", "the client omits the optional resume signal", (engine) => {
		engine.client = liveClient(engine.server.url, {}, false);
	});
}

export function startsWith(hint: import("#live.ts").LiveHint) {
	return liveNotesStory.trait("consumer", "the first hint targets only part of the scope", (engine) => Ref.set(engine.server.initialHint, hint));
}

export function watchingNotes() {
	return liveNotesStory.trait("consumer", "the consumer watches both notes and their list", function* (engine) {
		engine.registry.mount(engine.client.connection);
		const one = engine.client.api.get.query({ id: 1 });
		const two = engine.client.api.get.query({ id: 2 });
		engine.registry.mount(one);
		engine.registry.mount(two);
		engine.registry.mount(engine.client.api.list.query(undefined));
		yield* eventually(() => {
			expect(engine.registry.get(engine.client.status).connection).toBe("live");
			expect(Effect.runSync(Ref.get(engine.server.active))).toBe(1);
			expect(AsyncResult.getOrElse(engine.registry.get(one), () => undefined)?.body).toBe("First");
			expect(AsyncResult.getOrElse(engine.registry.get(two), () => undefined)?.body).toBe("Second");
		});
	});
}
