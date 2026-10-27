import { Effect, Layer, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { live } from "@shivaedev/contract/live.ts";
import { SettingsContract, SettingsRpc, settings } from "./contract.ts";

export function makeClient(url: string, token: string, entityId: number, httpClient: Layer.Layer<HttpClient.HttpClient>) {
	class Client extends AtomRpc.Service<Client>()("settings-example/Client", {
		group: SettingsRpc,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
			url,
		}).pipe(Layer.provide([httpClient, RpcSerialization.layerNdjson])),
	}) {}
	const api = bind(SettingsContract, Client);
	const subscription = live(Client.runtime, {
		resyncKeys: [settings.item(entityId)],
		stream: Stream.unwrap(Client.use((client) => Effect.succeed(client("subscribe", { entityId })))),
	});
	return {
		api,
		Client,
		entityId,
		query: api.get.query({ entityId }),
		...subscription,
	};
}
