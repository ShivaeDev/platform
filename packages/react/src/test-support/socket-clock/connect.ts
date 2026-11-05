import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Clock, Effect, Layer, Queue } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { Notes } from "./feature.ts";

export const connect = Effect.fnUntraced(function* (url: string, connections: Queue.Queue<string>, controlled = false) {
	const configured = controlled ? { runtime: yield* storyRuntime } : {};
	const client = makeClient(Notes, { ...configured, live: false, url, webSocketConstructor: layerWebSocketConstructorWS });
	const runtime = Atom.runtime(
		client.pipe(
			Layer.provideMerge(
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
	return { api: client.api, connection: client, runtime };
});
