import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import type { Reader } from "#browserClient.ts";
import { workRpcs } from "#rpc/contract.ts";
import { handoffContract } from "#rpc/handoffContract.ts";
import { responseContract } from "#rpc/responseContract.ts";

export function formClient() {
	class Client extends AtomRpc.Service<Reader>()("WorkBoard/FormTest", {
		group: workRpcs,
		protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/_board/rpc" }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		),
	}) {}
	return {
		handoffs: bind(handoffContract, Client, { live: false }),
		responses: bind(responseContract, Client, { live: false }),
		runtime: Client.runtime,
	};
}
