import { Effect, Layer, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Api } from "./sessionKeysApi.ts";

export const postChanges = Effect.fnUntraced(function* (url: string, cookie: string) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("cookie", cookie)),
		url,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const services = yield* Layer.build(protocol);
	const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services));
	return yield* client("account.$changes", { queries: [{ payload: { id: "theme" }, query: "get" }] }).pipe(Stream.runHead, Effect.exit);
});
