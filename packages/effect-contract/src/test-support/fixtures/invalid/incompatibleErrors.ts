import { Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { bind } from "#bind.ts";
import { Documents, Get, List, Subscribe } from "#test/live/contract.ts";

class Extra extends Schema.TaggedError<Extra>()("Extra", {}) {}
class Client extends AtomRpc.Service<Client>()("fixture/IncompatibleErrors", {
	group: RpcGroup.make(
		Rpc.make("documents.get", { error: Schema.Union([Get.error, Extra]), payload: Get.payload, success: Get.success }),
		Rpc.make("documents.list", { success: List.success }),
		Rpc.make("documents.subscribe", { error: Subscribe.error, payload: Subscribe.payload, stream: true, success: Subscribe.success }),
	),
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}
export const incompatibleErrors = bind(Documents, Client);
