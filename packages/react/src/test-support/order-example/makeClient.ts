import { Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
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
	const { api, Client } = makeRpcClient(Orders, {
		live: false,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
			url,
		}).pipe(Layer.provide([httpClient, RpcSerialization.layerJson])),
		url,
	});
	const renameOrder = Client.runtime.fn(api.save.run);

	return { api, Client, renameOrder };
}
