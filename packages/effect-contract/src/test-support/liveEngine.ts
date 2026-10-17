import { Effect, Ref, type Stream, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { liveClient } from "#test/live/client.ts";
import { liveServer } from "#test/live/server.ts";

export const liveEngine = Effect.gen(function* () {
	const server = yield* Effect.acquireRelease(
		Effect.promise(() => liveServer()),
		(current) => Effect.promise(current.close),
	);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	return { client: liveClient(server.url), registry, server };
});
export type LiveEngine = Effect.Success<typeof liveEngine>;

export function streamRunner(engine: LiveEngine) {
	const { client, registry } = engine;
	return <A, E>(effect: Effect.Effect<A, E, Stream.Services<ReturnType<typeof client.api.subscribe.run>>>, signal?: AbortSignal) =>
		Effect.acquireUseRelease(
			Effect.sync(() => registry.mount(client.Client.runtime)),
			() =>
				Effect.promise((scopeSignal) =>
					Effect.runPromiseExit(
						Effect.flatMap(AtomRegistry.getResult(registry, client.Client.runtime), (context) => Effect.provideContext(effect, context)),
						{ signal: signal === undefined ? scopeSignal : AbortSignal.any([signal, scopeSignal]) },
					),
				),
			(release) => Effect.sync(release),
		);
}

export function liveSnapshot({ client, server }: LiveEngine) {
	return {
		active: Effect.runSync(Ref.get(server.active)),
		connections: Effect.runSync(Ref.get(server.connections)),
		reads: Effect.runSync(Ref.get(server.reads)),
		received: Effect.runSync(SubscriptionRef.get(client.received)),
		stored: [...Effect.runSync(Ref.get(server.stored)).values()],
	};
}
