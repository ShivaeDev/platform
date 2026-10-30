import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Queue, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Notes } from "./feature.ts";

export const openViewer = Effect.fnUntraced(function* (url: string, viewer: number, count: number) {
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([layerWebSocket(url.replace(/^http/u, "ws"), { headers: { authorization: `viewer-${viewer}` } }), RpcSerialization.layerNdjson]),
	);
	const services = yield* Layer.build(protocol);
	const rpc = yield* RpcClient.make(Notes, { flatten: true }).pipe(Effect.provideContext(services));
	const queries = yield* Effect.forEach(
		Array.from({ length: count }, (_, slot) => slot),
		(slot) =>
			Effect.gen(function* () {
				const results = yield* Queue.unbounded<string>();
				yield* rpc("costNotes.$changes", { queries: [{ payload: { slot }, query: "get" }] }).pipe(
					Stream.mapEffect(() => rpc("costNotes.get", { slot })),
					Stream.runForEach((value) => Queue.offer(results, value)),
					Effect.forkScoped,
				);
				return results;
			}),
	);
	return { results: () => Effect.forEach(queries, (results) => Queue.take(results)) };
});
