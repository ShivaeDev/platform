import { Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Orders } from "./contract.ts";

export function makeClient({
	url,
	token,
	httpClient = FetchHttpClient.layer,
}: {
	readonly url: string;
	readonly token?: string | undefined;
	readonly httpClient?: Layer.Layer<HttpClient.HttpClient>;
}) {
	class Client extends AtomRpc.Service<Client>()("example/OrdersClient", {
		group: Orders,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
			url,
		}).pipe(Layer.provide([httpClient, RpcSerialization.layerJson])),
	}) {}
	const api = bind(Orders, Client);
	const renameOrder = Client.runtime.fn(api.save.run);

	return { api, Client, renameOrder };
}
