import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Clock, Effect, Layer, Queue } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { SocketClock } from "@shivaedev/contract/SocketClock.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { Notes } from "./feature.ts";

export const connect = Effect.fnUntraced(function* (url: string, connections: Queue.Queue<string>, controlled = false) {
	const configured = controlled ? { runtime: yield* storyRuntime } : {};
	const client = makeClient(Notes, { ...configured, live: false, url, webSocketConstructor: layerWebSocketConstructor });
	const clock = yield* Clock.Clock;
	const runtime = Atom.runtime(
		client.pipe(
			Layer.provideMerge(
				Layer.mergeAll(
					Layer.succeed(Clock.Clock, clock),
					controlled ? Layer.succeed(SocketClock, clock) : Layer.empty,
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
