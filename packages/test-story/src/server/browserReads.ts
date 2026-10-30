import { Context, Effect, Layer, PubSub, Schema } from "effect";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { LiveHint } from "@shivaedev/contract/live.ts";

export interface BrowserRead {
	readonly kind: "query" | "subscription";
	readonly payload: unknown;
	readonly tag: string;
}

export interface BrowserReadsOptions {
	readonly contracts: readonly {
		readonly declaration: { readonly name: string; readonly queries: readonly { readonly name: string }[] };
	}[];
	readonly headers?: Readonly<Record<string, string>>;
	readonly url: string;
	readonly webSocketConstructor?: Layer.Layer<Socket.WebSocketConstructor>;
}

export const browserReads = Effect.fn("BrowserStory.browserReads")(function* (options: BrowserReadsOptions) {
	const queries = new Set(options.contracts.flatMap(({ declaration }) => declaration.queries.map(({ name }) => `${declaration.name}.${name}`)));
	const subscriptions = new Set(options.contracts.map(({ declaration }) => `${declaration.name}.$changes`));
	const reads: BrowserRead[] = [];
	const hints: LiveHint[] = [];
	const deliveries = yield* PubSub.unbounded<LiveHint>();
	yield* Effect.addFinalizer(() => PubSub.shutdown(deliveries));
	const context = yield* Layer.build(
		RpcClient.layerProtocolSocket().pipe(
			Layer.provide(
				Socket.layerWebSocket(options.url.replace(/^http/u, "ws"), { headers: options.headers }).pipe(
					Layer.provide(options.webSocketConstructor ?? Socket.layerWebSocketConstructorGlobal),
				),
			),
			Layer.provide(RpcSerialization.layerNdjson),
		),
	);
	const underlying = Context.get(context, RpcClient.Protocol);
	const listening = new Set<string>();
	const protocol = Layer.succeed(RpcClient.Protocol, {
		...underlying,
		run: (clientId, receive) =>
			underlying.run(clientId, (message) =>
				Effect.gen(function* () {
					if (message._tag === "Chunk" && listening.has(`${clientId}:${message.requestId}`)) {
						for (const value of message.values) {
							const hint = yield* Schema.decodeUnknownEffect(LiveHint)(value).pipe(Effect.orDie);
							hints.push(hint);
							yield* PubSub.publish(deliveries, hint);
						}
					} else if (message._tag === "Exit") {
						listening.delete(`${clientId}:${message.requestId}`);
					}
					yield* receive(message);
				}),
			),
		send: (clientId, request, transferables) =>
			Effect.gen(function* () {
				if (request._tag === "Request") {
					if (subscriptions.has(request.tag)) {
						listening.add(`${clientId}:${request.id}`);
						reads.push({ kind: "subscription", payload: request.payload, tag: request.tag });
					} else if (queries.has(request.tag)) {
						reads.push({ kind: "query", payload: request.payload, tag: request.tag });
					}
				}
				yield* underlying.send(clientId, request, transferables);
			}),
	});
	return {
		hints: () => [...hints],
		protocol,
		readCount: (tag?: string) => reads.filter((read) => tag === undefined || read.tag === tag).length,
		reads: () => [...reads],
		watchHints: () => Effect.map(PubSub.subscribe(deliveries), (queue) => ({ next: PubSub.take(queue) })),
	};
});
