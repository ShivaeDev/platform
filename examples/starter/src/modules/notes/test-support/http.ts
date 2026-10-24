import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Notes } from "#modules/notes/notes.ts";

export function notesHttp(baseUrl: string, cookie = "", origin = baseUrl) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin })),
		url: `${baseUrl}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return RpcClient.make(Notes).pipe(Effect.provide(protocol));
}
