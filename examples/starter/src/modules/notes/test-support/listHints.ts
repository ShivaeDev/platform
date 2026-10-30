import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Queue, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { Notes } from "#modules/notes/notes.ts";
import type { RunningHost } from "#test-support/host.ts";

export const listHints = Effect.fn("AppStory.listHints")(function* (host: RunningHost, cookie: string) {
	const client = yield* makeClient(Notes, {
		headers: { cookie, origin: host.origin },
		url: `${host.baseUrl}/rpc`,
		webSocketConstructor: layerWebSocketConstructorWS,
	}).client;
	const hints = yield* Queue.unbounded<LiveHint>();
	yield* client["notes.$changes"]({ queries: [{ payload: undefined, query: "list" }] }).pipe(
		Stream.runForEach((hint) => Queue.offer(hints, hint)),
		Effect.forkScoped,
	);
	yield* Queue.take(hints);
	return {
		nextDelivery: () => Effect.map(Queue.take(hints), (hint) => (hint._tag === "Resync" ? { kind: "resync" } : { keys: hint.keys, kind: "change" })),
	};
});
