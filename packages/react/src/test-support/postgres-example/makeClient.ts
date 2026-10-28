import { Effect, type Layer, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { live } from "@shivaedev/contract/live.ts";
import { LiveOrders, Orders, orders } from "./contract.ts";

export function makeClient(url: string, token?: string, httpClient: Layer.Layer<HttpClient.HttpClient> = FetchHttpClient.layer) {
	const { api, Client } = makeRpcClient(Orders, {
		group: LiveOrders,
		httpClient,
		transformClient: (client) =>
			token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
		url,
	});
	const subscription = live(Client.runtime, {
		resyncKeys: [orders.item(1)],
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", { id: 1 })))),
	});
	const query = api.get.query({ id: 1 });
	return { api, Client, query, ...subscription };
}
