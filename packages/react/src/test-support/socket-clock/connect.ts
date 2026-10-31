import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Clock, Effect, Layer, Queue } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Notes } from "./feature.ts";

export const connect = Effect.fnUntraced(function* (url: string, connections: Queue.Queue<string>) {
	const client = makeClient(Notes, { live: false, url, webSocketConstructor: layerWebSocketConstructorWS });
	const runtime = Atom.runtime(
		client.pipe(
			Layer.provide(
				Layer.mergeAll(
					Layer.succeed(Clock.Clock, yield* Clock.Clock),
					Layer.succeed(RpcClient.ConnectionHooks, {
						onConnect: Queue.offer(connections, "connected").pipe(Effect.asVoid),
						onDisconnect: Queue.offer(connections, "disconnected").pipe(Effect.asVoid),
					}),
				),
			),
		),
	);
	return { api: client.api, runtime };
});
