import { Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "#bind.ts";
import { Documents, Get, List } from "#test/live/contract.ts";

class Extra extends Schema.TaggedError<Extra>()("Extra", {}) {}
class Client extends AtomRpc.Service<Client>()("fixture/IncompatibleErrors", {
	group: RpcGroup.make(
		Rpc.make("documents.get", { error: Schema.Union([Get.error, Extra]), payload: Get.payload, success: Get.success }),
		Rpc.make("documents.list", { success: List.success }),
	),
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}
export const incompatibleErrors = bind(Documents, Client);
