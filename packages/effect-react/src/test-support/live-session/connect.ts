import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Notes } from "./notes.ts";

export function connect(url: string) {
	class Client extends AtomRpc.Service<Client>()("live-session/Client", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	return bind(Notes, Client);
}
