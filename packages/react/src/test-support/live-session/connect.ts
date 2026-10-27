import { Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { Notes } from "./notes.ts";

export function connect(url: string, registry: AtomRegistry.AtomRegistry, token?: string) {
	class Client extends AtomRpc.Service<Client>()("live-session/Client", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({
			transformClient: (client) =>
				token === undefined ? client : HttpClient.mapRequest(client, HttpClientRequest.setHeader("authorization", `Bearer ${token}`)),
			url,
		}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	return bind(Notes, Client, { registry });
}
