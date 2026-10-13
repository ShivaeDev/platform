import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { DaemonContract, RPC_PATH } from "#host/daemonContract.ts";

export function daemonClient(url: string, headers: Readonly<Record<string, string>> = {}) {
	return RpcClient.make(DaemonContract, { flatten: true }).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({
				transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(headers)),
				url: `${url}${RPC_PATH}`,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
		),
	);
}
