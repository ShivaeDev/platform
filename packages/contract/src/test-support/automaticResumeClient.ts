import { Deferred, Effect, Layer, Ref, Stream, SubscriptionRef } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { bind } from "#bind.ts";
import type { ResumeSource } from "#resume.ts";
import { Notes } from "./notes.ts";
import type { notesServer } from "./notesServer.ts";

export function automaticResumeClient(server: Effect.Success<typeof notesServer>, resume?: ResumeSource) {
	const opened = Effect.runSync(SubscriptionRef.make(0));
	const active = Effect.runSync(SubscriptionRef.make(0));
	const ended = Effect.runSync(Ref.make(Effect.runSync(Deferred.make<void>())));
	const handlers = Notes.toLayer({
		...server.implementation,
		"notes.$changes": () =>
			Stream.unwrap(
				Effect.gen(function* () {
					yield* SubscriptionRef.update(opened, (count) => count + 1);
					yield* SubscriptionRef.update(active, (count) => count + 1);
					yield* Effect.addFinalizer(() => SubscriptionRef.update(active, (count) => count - 1));
					const end = yield* Ref.get(ended);
					return Stream.concat(Stream.succeed({ _tag: "Resync" } as const), Stream.drain(Stream.fromEffect(Deferred.await(end))));
				}),
			),
	});
	class Client extends AtomRpc.Service<Client>()("test/AutomaticResume", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: Layer.merge(handlers, server.guard),
	}) {}
	return {
		active,
		api: bind(Notes, Client, resume === undefined ? {} : { resume }),
		disconnect: Effect.gen(function* () {
			const previous = yield* Ref.getAndSet(ended, yield* Deferred.make<void>());
			yield* Deferred.succeed(previous, undefined);
		}),
		opened,
	};
}
