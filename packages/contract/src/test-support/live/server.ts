import { Deferred, Effect, PubSub, Ref, Stream, SubscriptionRef } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import type { LiveHint } from "#live.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { queryKeys } from "#serverMetadata.ts";
import { Note, notes } from "#test/notes.ts";
import { notesServer } from "#test/notesServer.ts";
import { Unavailable } from "./contract.ts";
import { hintStream } from "./hintStream.ts";
import { httpHost } from "./httpHost.ts";
import { Get, LiveNotes } from "./notesContract.ts";

export interface NotesSource {
	readonly edit: (id: number, body: string) => Promise<void>;
	readonly get: (id: number) => Promise<Note>;
	readonly list: () => Promise<readonly Note[]>;
}

export interface ServedRead {
	readonly at: number;
	readonly label: string;
}

export type ReadHold = "every note read" | "next note read" | "no read";

export async function liveServer(asset = "", source?: NotesSource) {
	const server = await Effect.runPromise(notesServer);
	await Effect.runPromise(
		Ref.set(
			server.stored,
			new Map([
				[1, new Note({ body: "First", id: 1, title: "One" })],
				[2, new Note({ body: "Second", id: 2, title: "Two" })],
			]),
		),
	);
	const initialHint = Effect.runSync(Ref.make<LiveHint>({ _tag: "Resync" }));
	const reactivity = Effect.runSync(Reactivity.make);
	const hints = await Effect.runPromise(makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity)));
	const unavailable = Effect.runSync(Ref.make(false));
	const streamUnavailable = Effect.runSync(Ref.make(false));
	const disconnect = Effect.runSync(Ref.make(Effect.runSync(Deferred.make<void>())));
	const served = Effect.runSync(SubscriptionRef.make<readonly ServedRead[]>([]));
	const holding = Effect.runSync(Ref.make<ReadHold>("no read"));
	const held = Effect.runSync(SubscriptionRef.make(0));
	const release = Effect.runSync(Deferred.make<void>());
	function serve(label: string) {
		return SubscriptionRef.update(served, (all) => [...all, { at: performance.now(), label }]);
	}
	const hold = Effect.gen(function* () {
		const mode = yield* Ref.getAndUpdate(holding, (current) => (current === "next note read" ? "no read" : current));
		if (mode === "no read") {
			return;
		}
		yield* Effect.acquireUseRelease(
			SubscriptionRef.update(held, (count) => count + 1),
			() => Deferred.await(release),
			() => SubscriptionRef.update(held, (count) => count - 1),
		);
	});
	const events = Effect.runSync(PubSub.bounded<LiveHint>(256));
	const connections = Effect.runSync(SubscriptionRef.make(0));
	const active = Effect.runSync(SubscriptionRef.make(0));
	const handlers = LiveNotes.toLayer({
		...server.implementation,
		"notes.$changes": ({ queries }) => Stream.unwrap(Effect.map(queryKeys(LiveNotes.declaration.queries, queries), (keys) => hints.stream(keys))),
		"notes.get": ({ id }) =>
			Effect.gen(function* () {
				yield* serve(`get:${id}`);
				const local = yield* server.implementation["notes.get"]({ id });
				const note = source === undefined ? local : yield* Effect.promise(() => source.get(id));
				yield* hold;
				if (yield* Ref.get(unavailable)) {
					return yield* Get.reject.Unavailable({});
				}
				return note;
			}),
		"notes.list": () =>
			Effect.andThen(
				serve("list"),
				source === undefined
					? server.implementation["notes.list"]()
					: Effect.andThen(server.implementation["notes.list"](), Effect.promise(source.list)),
			),
		"notes.subscribe": () =>
			Stream.unwrap(
				Effect.gen(function* () {
					yield* SubscriptionRef.update(connections, (count) => count + 1);
					if (yield* Ref.get(streamUnavailable)) {
						return Stream.fail(new Unavailable());
					}
					const ended = yield* Ref.get(disconnect);
					const firstHint = yield* Ref.get(initialHint);
					const keys = [...(yield* Ref.get(server.stored)).keys()].map((id) => notes.item(id));
					const injected = yield* PubSub.subscribe(events);
					return Stream.merge(hintStream(hints, keys, active, firstHint), Stream.fromEffectRepeat(PubSub.take(injected))).pipe(
						Stream.interruptWhen(Deferred.await(ended)),
					);
				}),
			),
	});
	const host = await httpHost(handlers, server.guard, asset);
	async function store(id: number, body: string) {
		if (source !== undefined) {
			await source.edit(id, body);
		}
		await Effect.runPromise(
			Ref.update(server.stored, (all) => {
				const note = all.get(id);
				return note === undefined ? all : new Map([...all, [id, new Note({ ...note, body })]]);
			}),
		);
	}
	return {
		...host,
		...server,
		active,
		close: async () => {
			await Effect.runPromise(Effect.andThen(Deferred.succeed(release, undefined), PubSub.shutdown(events)));
			await host.close();
		},
		connections,
		disconnect: () =>
			Effect.runPromise(
				Effect.gen(function* () {
					const next = yield* Deferred.make<void>();
					const previous = yield* Ref.getAndSet(disconnect, next);
					yield* Deferred.succeed(previous, undefined);
				}),
			),
		edit: async (id: number, body: string) => {
			await store(id, body);
			await Effect.runPromise(reactivity.invalidate(invalidationKeys([notes.item(id)])));
		},
		emit: (hint: LiveHint) => Effect.runPromise(PubSub.publish(events, hint)),
		held,
		holding,
		initialHint,
		reactivity,
		releaseHeld: () => Deferred.succeed(release, undefined),
		served,
		store,
		streamUnavailable,
		unavailable,
	};
}
