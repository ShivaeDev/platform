import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcGroup, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "#bind.ts";
import { Notes } from "#test/notes.ts";

class Client extends AtomRpc.Service<Client>()("fixture/IncompleteClient", {
	group: RpcGroup.make(),
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}
export const incompleteClient = bind(Notes, Client);
