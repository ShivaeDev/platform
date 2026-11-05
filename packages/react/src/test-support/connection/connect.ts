import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer, Queue } from "effect";
import { RpcClient } from "effect/rpc";
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
	const client = makeClient(Notes, { group: Api, runtime, url, webSocketConstructor: layerWebSocketConstructor });
	return { client, events, summary: bind(Summary, client.Client) };
});
