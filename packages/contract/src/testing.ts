import { Deferred, type Duration, Effect, Fiber, Layer, Queue, Stream, SubscriptionRef } from "effect";
import { type Rpc, RpcClient, type RpcGroup, type RpcMessage, RpcSerialization, RpcServer } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { SubscriptionHint } from "#queryUpdate.ts";

export interface HintViewer<E> {
	readonly finished: Effect.Effect<void, E>;
	readonly hints: SubscriptionRef.SubscriptionRef<readonly SubscriptionHint[]>;
}

export const watchHints = Effect.fn("Live.watchHints")(function* <E, R>(stream: Stream.Stream<SubscriptionHint, E, R>) {
	const hints = yield* SubscriptionRef.make<readonly SubscriptionHint[]>([]);
	const ready = yield* Deferred.make<void>();
	const fiber = yield* stream.pipe(
		Stream.runForEach((hint) =>
			SubscriptionRef.update(hints, (received) => [...received, hint]).pipe(Effect.andThen(Deferred.succeed(ready, undefined))),
		),
		Effect.forkScoped,
	);
	const finished = Fiber.join(fiber);
	yield* Effect.raceFirst(Deferred.await(ready), finished);
	return { finished, hints } satisfies HintViewer<E>;
});

export const heard = Effect.fn("Live.heard")(function* <E>(
	viewer: HintViewer<E>,
	keys: readonly Key[],
	options: { readonly within?: Duration.Input } = {},
) {
	const matching = SubscriptionRef.changes(viewer.hints).pipe(
		Stream.filter((hints) => hints.some((hint) => namesKeys(hint, keys))),
		Stream.runHead,
		Effect.as(true),
	);
	return yield* Effect.raceFirst(matching, Effect.as(viewer.finished, false)).pipe(
		Effect.timeoutOrElse({ duration: options.within ?? "1 second", orElse: () => Effect.succeed(false) }),
	);
});

function namesKeys(hint: SubscriptionHint, keys: readonly Key[]): boolean {
	return hint._tag === "Changed" && keys.every((key) => hint.keys.some((actual) => JSON.stringify(actual) === JSON.stringify(key)));
}

export function layerMemoryProtocol<TRpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<TRpcs>) {
	return Layer.effect(
		RpcClient.Protocol,
		Effect.gen(function* () {
			const requests = yield* Queue.unbounded<readonly [number, RpcMessage.FromClientEncoded]>();
			const disconnects = yield* Queue.unbounded<number>();
			const { codecFor } = yield* RpcSerialization.RpcSerialization;
			const protocol = yield* RpcClient.Protocol.make((send, clientIds) =>
				Effect.gen(function* () {
					const server = RpcServer.Protocol.of({
						clientIds: Effect.sync(() => clientIds),
						codecFor,
						disconnects,
						end: () => Effect.void,
						initialMessage: Effect.succeedNone,
						run: (receive) => Effect.forever(Effect.flatMap(Queue.take(requests), ([id, message]) => receive(id, message))),
						send,
						supportsAck: true,
						supportsNotifications: true,
						supportsSpanPropagation: true,
						supportsTransferables: false,
					});
					yield* RpcServer.make(group).pipe(Effect.provideService(RpcServer.Protocol, server), Effect.forkScoped);
					return {
						codecFor,
						send: (clientId, request) => Queue.offer(requests, [clientId, request]).pipe(Effect.asVoid),
						supportsAck: true,
						supportsTransferables: false,
					};
				}),
			);
			return {
				...protocol,
				run: (clientId, receive) => protocol.run(clientId, receive).pipe(Effect.ensuring(Queue.offer(disconnects, clientId))),
			} satisfies RpcClient.Protocol["Service"];
		}),
	).pipe(Layer.provide(RpcSerialization.layerNdjson));
}
