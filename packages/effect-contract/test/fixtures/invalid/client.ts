import { Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { bind } from "../../../src/index.ts";
import { Notes } from "../../notes.ts";

export class Client extends AtomRpc.Service<Client>()("fixture/InvalidClient", {
	group: Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
}) {}

export const api = bind(Notes, Client);
