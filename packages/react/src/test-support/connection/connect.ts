import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer, Queue } from "effect";
import { RpcClient } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { Notes, Summary } from "#test/connection/feature.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

export const connect = Effect.fnUntraced(function* (url: string) {
	const events = yield* Queue.unbounded<string>();
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(
		Layer.succeed(RpcClient.ConnectionHooks, {
			onConnect: Queue.offer(events, "connected").pipe(Effect.asVoid),
			onDisconnect: Queue.offer(events, "disconnected").pipe(Effect.asVoid),
		}),
	);
	const client = makeClient({ notes: Notes, summary: Summary }, { runtime, url, webSocketConstructor: layerWebSocketConstructor });
	return { client, events, notes: client.api.notes, summary: client.api.summary };
});
