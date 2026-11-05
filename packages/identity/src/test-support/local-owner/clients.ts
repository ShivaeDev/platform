import * as NodeWs from "@effect/platform-node/NodeWS";
import { Deferred, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { authenticateSocket } from "@shivaedev/contract/socketAuthentication.ts";
import { Api } from "./api.ts";

export function httpClient(url: string, token?: string) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) =>
			HttpClient.mapRequest(client, HttpClientRequest.setHeaders(token === undefined ? {} : { authorization: `Bearer ${token}` })),
		url,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api).pipe(Effect.provideContext(services)));
}

export const socketClient = Effect.fnUntraced(function* (url: string, token: string) {
	const closed = yield* Deferred.make<{ code: number; reason: string }>();
	const webSocketConstructor = Layer.succeed(Socket.WebSocketConstructor, (address, protocols) => {
		if (protocols !== undefined && typeof protocols !== "string" && !Array.isArray(protocols)) {
			throw new Error("The local client cannot set upgrade headers");
		}
		const socket = new NodeWs.WebSocket(address, protocols);
		socket.addEventListener("close", (event) => Effect.runSync(Deferred.succeed(closed, { code: event.code, reason: event.reason })));
		return socket;
	});
	const raw = Socket.layerWebSocket(`${url.replace(/^http/u, "ws")}?auth=frame`).pipe(Layer.provide(webSocketConstructor));
	const authenticated = Layer.effect(Socket.Socket, authenticateSocket(token)).pipe(Layer.provide(raw));
	const protocol = RpcClient.layerProtocolSocket().pipe(Layer.provide([authenticated, RpcSerialization.layerNdjson]));
	const services = yield* Layer.build(protocol);
	const client = yield* RpcClient.make(Api).pipe(Effect.provideContext(services));
	return { client, closed: Deferred.await(closed) };
});
