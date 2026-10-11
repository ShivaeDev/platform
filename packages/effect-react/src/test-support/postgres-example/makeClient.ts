import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { live } from "@shivaedev/effect-contract/live.ts";
import { LiveOrders, Orders, orders } from "./contract.ts";

export function makeClient(url: string, token?: string, httpClient: Layer.Layer<HttpClient.HttpClient> = FetchHttpClient.layer) {
	class Client extends AtomRpc.Service<Client>()("postgres-example/Client", {
		group: LiveOrders,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
			url,
		}).pipe(Layer.provide([httpClient, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(Orders, Client);
	const subscription = live(Client.runtime, {
		resyncKeys: [orders.item(1)],
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", { id: 1 })))),
	});
	const query = api.get.query({ id: 1 });
	return { api, Client, query, ...subscription };
}
