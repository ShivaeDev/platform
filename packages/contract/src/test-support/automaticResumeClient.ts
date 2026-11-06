import { Deferred, Effect, Layer, Ref, Stream, SubscriptionRef } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { bind } from "#bind.ts";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { compareQueries } from "#compareQueries.ts";
import { querySubscription } from "#querySubscription.ts";
import { CurrentViewer } from "#readPolicy.ts";
import type { ResumeSource } from "#resume.ts";
import { Notes } from "./notes.ts";
import type { notesServer } from "./notesServer.ts";

export function automaticResumeClient(server: Effect.Success<typeof notesServer>, runtime: Atom.RuntimeFactory, resume?: ResumeSource) {
	const opened = Effect.runSync(SubscriptionRef.make(0));
	const active = Effect.runSync(SubscriptionRef.make(0));
	const ended = Effect.runSync(Effect.flatMap(Deferred.make<void>(), Ref.make));
	const application = Notes.application.toLayer(server.implementation);
	const changes = changesHandlerLayer(
		Notes,
		() =>
			({ queries }, options) =>
				Stream.unwrap(
					Effect.gen(function* () {
						yield* SubscriptionRef.update(opened, (count) => count + 1);
						yield* SubscriptionRef.update(active, (count) => count + 1);
						yield* Effect.addFinalizer(() => SubscriptionRef.update(active, (count) => count - 1));
						const end = yield* Ref.get(ended);
						const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
						const updates = yield* compareQueries(
							subscription,
							rerunQuery(Notes.application.omit("notes.create", "notes.rename"), options),
						)({ _tag: "Resync" });
						return Stream.concat(Stream.fromIterable(updates), Stream.drain(Stream.fromEffect(Deferred.await(end))));
					}),
				),
	);
	const handlers = Layer.merge(application, changes.pipe(Layer.provide(application)));
	class Client extends AtomRpc.Service<Client>()("test/AutomaticResume", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: Layer.merge(handlers, server.guard),
		runtime,
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
