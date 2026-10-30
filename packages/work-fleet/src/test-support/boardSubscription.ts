import { Deferred, Effect, Fiber, Layer, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { workRpcs } from "@shivaedev/work-board/rpc/contract.ts";

export const boardSubscription = Effect.fn("SupervisorStory.boardSubscription")(function* (port: number) {
	const started = yield* Deferred.make<void>();
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide(Socket.layerWebSocket(`ws://127.0.0.1:${port}/_board/rpc`).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal))),
		Layer.provide(RpcSerialization.layerNdjson),
	);
	const subscription = yield* Effect.forkScoped(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(workRpcs, { flatten: true });
				yield* client("work-board.$changes", { queries: [{ payload: undefined, query: "watcher" }] }).pipe(
					Stream.tap(() => Deferred.succeed(started, undefined)),
					Stream.runDrain,
				);
			}),
		).pipe(Effect.provide(protocol)),
	);
	yield* Deferred.await(started).pipe(Effect.timeout("5 seconds"));
	return { closed: Fiber.await(subscription) };
});
