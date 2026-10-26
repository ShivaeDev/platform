import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { actionTrace } from "#actionTrace.ts";
import { Api } from "./Api.ts";

export function connect(url: string) {
	class Client extends AtomRpc.Service<Client>()("action-story/Client", {
		group: Api,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
	}) {}
	let id = 0;
	function run() {
		return Effect.gen(function* () {
			const client = yield* Client;
			id += 1;
			yield* client("write", { id });
			id += 1;
			return yield* client("write", { id });
		});
	}
	return { action: Client.runtime.fn(() => actionTrace(run(), "ui.write")), run, runtime: Client.runtime };
}
