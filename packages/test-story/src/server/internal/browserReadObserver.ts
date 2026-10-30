import { Effect, PubSub, Schema } from "effect";
import { RpcClient, type RpcMessage } from "effect/rpc";
import { LiveHint } from "@shivaedev/contract/live.ts";
import type { BrowserRead, BrowserReadsOptions } from "#browserReads.ts";
import { browserSubscriptions } from "./browserSubscriptions.ts";

export const browserReadObserver = Effect.fnUntraced(function* (contracts: BrowserReadsOptions["contracts"]) {
	const queries = new Set(contracts.flatMap(({ declaration }) => declaration.queries.map(({ name }) => `${declaration.name}.${name}`)));
	const subscriptionTags = new Set(contracts.map(({ declaration }) => `${declaration.name}.$changes`));
	const reads: BrowserRead[] = [];
	const hints: LiveHint[] = [];
	const deliveries = yield* PubSub.unbounded<LiveHint>();
	yield* Effect.addFinalizer(() => PubSub.shutdown(deliveries));
	const tracked = yield* browserSubscriptions;
	const receive = Effect.fnUntraced(function* (index: number | undefined, message: RpcMessage.FromServerEncoded) {
		if (index === undefined) {
			return;
		}
		yield* tracked.receive(index, message);
		if (message._tag !== "Chunk") {
			return;
		}
		for (const value of message.values) {
			if (Schema.is(LiveHint)(value)) {
				hints.push(value);
				yield* PubSub.publish(deliveries, value);
			}
		}
	});
	return {
		hints: () => [...hints],
		observeProtocol: Effect.gen(function* () {
			const underlying = yield* RpcClient.Protocol;
			const listening = new Map<string, number>();
			function record(clientId: number, request: RpcMessage.RequestEncoded) {
				if (subscriptionTags.has(request.tag)) {
					listening.set(`${clientId}:${request.id}`, tracked.open(request.payload, request.tag));
					reads.push({ kind: "subscription", payload: request.payload, tag: request.tag });
				} else if (queries.has(request.tag)) {
					reads.push({ kind: "query", payload: request.payload, tag: request.tag });
				}
			}
			const observeMessage = Effect.fnUntraced(function* (clientId: number, message: RpcMessage.FromServerEncoded) {
				const key = "requestId" in message ? `${clientId}:${message.requestId}` : undefined;
				yield* receive(key === undefined ? undefined : listening.get(key), message);
				if (message._tag === "Exit") {
					listening.delete(`${clientId}:${message.requestId}`);
				}
			});
			const protocol: RpcClient.Protocol["Service"] = {
				...underlying,
				run: (clientId, deliver) =>
					underlying.run(clientId, (message) => observeMessage(clientId, message).pipe(Effect.andThen(() => deliver(message)))),
				send: (clientId, request, transferables) =>
					Effect.gen(function* () {
						if (request._tag === "Request") {
							record(clientId, request);
						}
						yield* underlying.send(clientId, request, transferables);
					}),
			};
			return protocol;
		}),
		readCount: (tag?: string) => reads.filter((read) => tag === undefined || read.tag === tag).length,
		reads: () => [...reads],
		subscriptions: tracked.subscriptions,
		waitForSubscriptions: tracked.waitForSubscriptions,
		watchHints: () => Effect.map(PubSub.subscribe(deliveries), (queue) => ({ next: PubSub.take(queue) })),
	};
});
