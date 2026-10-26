import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Api } from "./feature.ts";

export function connect(url: string) {
	class Client extends AtomRpc.Service<Client>()("automatic/Client", {
		group: Api,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	return { api: bind(Api, Client), runtime: Client.runtime };
}
