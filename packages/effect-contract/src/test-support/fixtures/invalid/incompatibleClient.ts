import { Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "#bind.ts";
import { Documents, Get, List } from "#test/live/contract.ts";

class Client extends AtomRpc.Service<Client>()("fixture/IncompatibleClient", {
	group: RpcGroup.make(
		Rpc.make("documents.get", { error: Get.error, payload: { id: Schema.Number }, success: Get.success }),
		Rpc.make("documents.list", { success: List.success }),
	),
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}
export const incompatibleClient = bind(Documents, Client);
