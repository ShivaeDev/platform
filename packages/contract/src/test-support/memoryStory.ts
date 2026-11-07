import { Effect, Exit, Layer, Ref, Schema, Scope, Stream, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { type HintViewer, layerMemoryProtocol, watchHints } from "@shivaedev/test-kits/contract/testing.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { makeClient } from "#bind.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { answered, shown, streams, updateWords } from "#test/answers.ts";
import { Note, Notes, notes } from "#test/notes.ts";
import { notesServer } from "#test/notesServer.ts";
import { type Mark, markQuery, reRead } from "#test/reRead.ts";
import { settled } from "#test/settled.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const memoryEngine = Effect.gen(function* () {
	const runtime = yield* storyRuntime;
	const server = yield* notesServer;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const active = yield* SubscriptionRef.make(0);
	const application = Notes.application.toLayer({
		...server.implementation,

		"notes.rename": (payload) =>
			Effect.gen(function* () {
				const note = yield* server.implementation["notes.rename"](payload);
				yield* reactivity.invalidate(invalidationKeys([notes.item(payload.id)]));
				return note;
			}),
	});
	const changes = changesHandlerLayer(
		Notes,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						yield* SubscriptionRef.update(active, (count) => count + 1);
						return live
							.subscribe(subscription, rerunQuery(Notes.application.omit("notes.create", "notes.rename"), options))
							.pipe(Stream.ensuring(SubscriptionRef.update(active, (count) => count - 1)));
					}),
				),
	);
	const handlers = Layer.merge(application, changes.pipe(Layer.provide(application)));
	const transport = yield* Layer.build(layerMemoryProtocol(Notes).pipe(Layer.provide([handlers, server.guard])));
	const connection = makeClient(Notes, { protocol: Layer.succeedContext(transport), runtime, url: "memory://notes" });
	const client = yield* connection.client;
	const other = yield* connection.client;
	const listeners = new Map<number, { readonly scope: Scope.Closeable; readonly viewer: HintViewer<unknown> }>();
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const query = connection.api.get.query({ id: 1 });
	const marked = new Map<string, Mark>();
	return { active, client, connection, listeners, marked, other, query, registry, server };
});

export const memoryStory = storyKit({
	clock: "test",
	create: () => memoryEngine,
	name: "in-memory clients",
	stages: ["access", "listeners", "screen"],
	verbs: (engine, story) => ({
		close: (id: number) =>
			Effect.gen(function* () {
				story.tell(`the client closes its subscription to note ${id}`);
				const listener = engine.listeners.get(id);
				if (listener === undefined) {
					return yield* Effect.die(`No listener for note ${id}`);
				}
				yield* Scope.close(listener.scope, Exit.void);
				yield* until(SubscriptionRef.changes(engine.active), (count) => count === engine.listeners.size - 1, { name: "active subscriptions" });
				engine.listeners.delete(id);
			}),
		get: (id: number) => {
			story.tell(`the client reads note ${id} through makeClient`);
			return answered(
				engine.client["notes.get"]({ id }),
				(note) => `${note instanceof Note ? "decoded" : "undecoded"} note ${note.id} titled ${note.title}`,
			);
		},
		hints: (id: number) => {
			const listener = engine.listeners.get(id);
			if (listener === undefined) {
				throw new Error(`No listener for note ${id}`);
			}
			return Effect.map(SubscriptionRef.get(listener.viewer.hints), (hints) =>
				hints.map((update) =>
					update._tag === "Result" && Schema.is(Note)(update.value) ? `note ${update.value.id} titled ${update.value.title}` : updateWords(update),
				),
			);
		},
		nextHint: (id: number) => {
			const listener = engine.listeners.get(id);
			if (listener === undefined) {
				throw new Error(`No listener for note ${id}`);
			}
			return until(SubscriptionRef.changes(listener.viewer.hints), (hints) => hints.length > 1, { name: "live hint" });
		},
		openSubscriptions: () => Effect.map(SubscriptionRef.get(engine.active), (count) => streams(count, "open")),
		parallelReads: () => {
			story.tell("two clients read different notes concurrently over the shared protocol");
			return Effect.all([engine.client["notes.get"]({ id: 1 }), engine.other["notes.get"]({ id: 2 })], { concurrency: "unbounded" }).pipe(
				Effect.map((rows) => rows.map((row) => row.title)),
			);
		},
		refreshed: () => reRead(engine.registry, engine.query, engine.marked.get("note")),
		rename: (id: number, title: string) => {
			story.tell(`the client renames note ${id} to ${title} through makeClient`);
			return answered(engine.client["notes.rename"]({ id, title }), (note) => `renamed note ${note.id} to ${note.title}`);
		},
		shownTitle: () => Effect.map(settled(engine.registry, engine.query), (result) => shown(result, (note) => note.title)),
	}),
});

export const memoryDenied = memoryStory.trait("access", "the server denies this session", ({ server }) => Ref.set(server.denied, true));

export function memoryListening(id: number) {
	return memoryStory.trait("listeners", `the client listens to note ${id}`, function* (engine) {
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer((exit) => Scope.close(scope, exit));
		const viewer = yield* watchHints(engine.client["notes.$changes"]({ queries: [{ payload: { id }, query: "get" }] })).pipe(Scope.provide(scope));
		engine.listeners.set(id, { scope, viewer });
	});
}

export const memoryViewing = memoryStory.trait("screen", "the client watches note 1 through its bound query", function* (engine) {
	engine.registry.mount(engine.query);
	yield* settled(engine.registry, engine.query);
	engine.marked.set("note", markQuery(engine.registry, engine.query));
});
