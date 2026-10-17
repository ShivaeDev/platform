import { Deferred, Effect, Ref, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "#keys.ts";
import type { LiveHint } from "#live.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { makeServer, Note, notes } from "#test/notes.ts";
import { Unavailable } from "./contract.ts";
import { hintStream } from "./hintStream.ts";
import { httpHost } from "./httpHost.ts";
import { Get, LiveNotes } from "./notesContract.ts";

export async function liveServer(asset = "", initial: LiveHint = { _tag: "Resync" }) {
	const server = await Effect.runPromise(makeServer);
	await Effect.runPromise(
		Ref.set(
			server.stored,
			new Map([
				[1, new Note({ body: "First", id: 1, title: "One" })],
				[2, new Note({ body: "Second", id: 2, title: "Two" })],
			]),
		),
	);
	const initialHint = Effect.runSync(Ref.make(initial));
	const reactivity = Effect.runSync(Reactivity.make);
	const hints = await Effect.runPromise(makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity)));
	const secondHints = await Effect.runPromise(makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity)));
	const unavailable = Effect.runSync(Ref.make(false));
	const streamUnavailable = Effect.runSync(Ref.make(false));
	const disconnect = Effect.runSync(Ref.make(Effect.runSync(Deferred.make<void>())));
	const gate = Effect.runSync(Ref.make<Effect.Effect<void>>(Effect.void));
	const connections = Effect.runSync(Ref.make(0));
	const active = Effect.runSync(Ref.make(0));
	const handlers = LiveNotes.toLayer({
		...server.implementation,
		"notes.get": ({ id }) =>
			Effect.gen(function* () {
				const note = yield* server.implementation["notes.get"]({ id });
				yield* yield* Ref.get(gate);
				if (yield* Ref.get(unavailable)) {
					return yield* Get.reject.Unavailable({});
				}
				return note;
			}),
		"notes.subscribe": () =>
			Stream.unwrap(
				Effect.gen(function* () {
					yield* Ref.update(connections, (count) => count + 1);
					if (yield* Ref.get(streamUnavailable)) {
						return Stream.fail(new Unavailable());
					}
					const ended = yield* Ref.get(disconnect);
					const firstHint = yield* Ref.get(initialHint);
					const keys = [...(yield* Ref.get(server.stored)).keys()].map((id) => notes.item(id));
					return hintStream(hints, keys, active, firstHint).pipe(Stream.interruptWhen(Deferred.await(ended)));
				}),
			),
		"notes.watch": ({ id, helper }) => (helper === "first" ? hints : secondHints).stream([notes.item(id)]),
	});
	const host = await httpHost(handlers, server.guard, asset);
	return {
		...host,
		...server,
		active,
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
			await Effect.runPromise(
				Ref.update(server.stored, (all) => {
					const note = all.get(id);
					return note === undefined ? all : new Map([...all, [id, new Note({ ...note, body })]]);
				}),
			);
			await Effect.runPromise(reactivity.invalidate(invalidationKeys([notes.item(id)])));
		},
		emit: (hint: LiveHint) => Effect.runPromise(hint._tag === "Resync" ? hints.resync : reactivity.invalidate(invalidationKeys(hint.keys))),
		gate,
		hints,
		initialHint,
		reactivity,
		secondHints,
		streamUnavailable,
		unavailable,
	};
}
