import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Stream } from "effect";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { live } from "@shivaedev/contract/live.ts";
import { LiveOrders, Orders, orders } from "./contract.ts";

export function makeClient(url: string, token?: string) {
	const { api, Client } = makeRpcClient(Orders, {
		group: LiveOrders,
		headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
		live: false,
		url,
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const subscription = live(Client.runtime, {
		resyncKeys: [orders.item(1)],
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", { id: 1 })))),
	});
	const query = api.get.query({ id: 1 });
	return { api, Client, query, ...subscription };
}
