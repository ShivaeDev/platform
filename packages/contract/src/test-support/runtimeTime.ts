import { Clock, Effect, Layer, Queue, Ref, Stream, SubscriptionRef } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { makeClient } from "#bind.ts";
import { type LiveHint, live } from "#live.ts";
import { queryCoalesceWindow } from "#queryCoalesceWindow.ts";
import { times } from "./answers.ts";
import { Note, Notes, notes } from "./notes.ts";
import { notesServer } from "./notesServer.ts";

type View = "note 1" | "the list";

const runtimeTimeEngine = Effect.gen(function* () {
	const server = yield* notesServer;
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
	runtime.addGlobalLayer(Layer.succeed(Clock.Clock, yield* Clock.Clock));
	const transport = yield* Layer.build(layerMemoryProtocol(Notes).pipe(Layer.provide(server.layer)));
	const connectionClient = makeClient(Notes, { live: false, protocol: Layer.succeedContext(transport), runtime, url: "memory://runtime-time" });
	const { api, Client } = connectionClient;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const hints = yield* Queue.unbounded<LiveHint>();
	const handled = yield* SubscriptionRef.make(0);
	const connection = live(Client.runtime, {
		resyncKeys: [notes.item(1), notes.list],
		stream: Stream.fromQueue(hints).pipe(
			Stream.flatMap((hint) =>
				Stream.concat(Stream.succeed(hint), Stream.drain(Stream.fromEffect(SubscriptionRef.update(handled, (count) => count + 1)))),
			),
		),
	});
	const views: Record<View, Atom.Atom<AsyncResult.AsyncResult<Note | readonly Note[], unknown>>> = {
		"note 1": api.get.query({ id: 1 }),
		"the list": Client.query("notes.list", undefined, { reactivityKeys: invalidationKeys([notes.list]) }),
	};
	for (const atom of Object.values(views)) {
		registry.mount(atom);
		yield* AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
	}
	function emit(hint: LiveHint) {
		return Effect.gen(function* () {
			const before = yield* SubscriptionRef.get(handled);
			yield* Queue.offer(hints, hint);
			yield* until(SubscriptionRef.changes(handled), (count) => count > before, { name: "handled live hint" });
		});
	}
	registry.mount(connection.connection);
	yield* emit({ _tag: "Resync" });
	for (const atom of Object.values(views)) {
		yield* AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });
	}
	return { connection, emit, registry, server, views };
});

export const runtimeTime = storyKit({
	create: () => runtimeTimeEngine,
	name: "live runtime clock",
	stages: ["window"],
	verbs: ({ connection, emit, registry, server, views }, story) => ({
		advance: (milliseconds: number) => {
			story.tell(`the runtime clock advances ${milliseconds} milliseconds`);
			return TestClock.adjust(milliseconds);
		},
		dispose: () => {
			story.tell("the client disposes its registry");
			registry.dispose();
		},
		edit: (title: string) =>
			Effect.gen(function* () {
				story.tell(`note 1 becomes ${title} and its change is announced`);
				yield* Ref.update(server.stored, (all) => new Map([...all, [1, new Note({ body: "", id: 1, title })]]));
				yield* emit({ _tag: "Changed", keys: [notes.item(1)] });
			}),
		pause: () => {
			story.tell("the client pauses live reads");
			registry.set(connection.paused, true);
		},
		resync: () => {
			story.tell("the server asks the client to resync");
			return emit({ _tag: "Resync" });
		},
		shown: (view: keyof typeof views) =>
			Effect.map(AtomRegistry.getResult(registry, views[view], { suspendOnWaiting: true }), (value) =>
				value instanceof Note ? value.title : value.map((note) => note.title),
			),
		timesRead: (view: keyof typeof views) =>
			Effect.map(
				SubscriptionRef.get(server.reads),
				(reads) => `read ${times(reads.filter((label) => label === (view === "note 1" ? "get:1" : "list")).length)}`,
			),
	}),
});

export function noteWindow(milliseconds: number) {
	return runtimeTime.trait("window", `note 1 has its own ${milliseconds} millisecond window`, ({ registry, views }) => {
		registry.set(queryCoalesceWindow(views["note 1"]), milliseconds);
	});
}
