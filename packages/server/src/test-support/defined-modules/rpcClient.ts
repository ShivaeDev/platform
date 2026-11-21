import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization } from "effect/rpc";

// The sessions fixture signs in whoever sends "alice" as authorization, and an empty value is a visitor.
export function rpcClient<TRpcs extends Rpc.Any>(group: RpcGroup.RpcGroup<TRpcs>, url: string, authorization: "alice" | "" = "") {
	return RpcClient.make(group, { flatten: true }).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({
				transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", authorization)),
				url,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
		),
	);
}
