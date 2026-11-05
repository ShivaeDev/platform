import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Clock, Effect, Layer, Queue } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import { storyRuntime } from "#test/storyRuntime.ts";
import { Api, Notes, Summary } from "./feature.ts";

export const connect = Effect.fnUntraced(function* (url: string) {
	const events = yield* Queue.unbounded<string>();
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(
		Layer.succeed(RpcClient.ConnectionHooks, {
			onConnect: Queue.offer(events, "connected").pipe(Effect.asVoid),
			onDisconnect: Queue.offer(events, "disconnected").pipe(Effect.asVoid),
		}),
	);
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide(Socket.layerWebSocket(url.replace(/^http/u, "ws")).pipe(Layer.provide(layerWebSocketConstructorWS))),
		Layer.provide(RpcSerialization.layerNdjson),
		Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())),
	);
	const client = makeClient(Notes, { group: Api, protocol, runtime, url });
	return { client, events, summary: bind(Summary, client.Client) };
});
