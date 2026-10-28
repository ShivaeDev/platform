import { Effect, Layer } from "effect";
import { HttpServerRequest } from "effect/http";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { Socket } from "effect/socket";
import type { OriginPolicy } from "#server/origin.ts";
import { Api, type ApiClient, serverLayer } from "#test/rpc/api.ts";
import { ORIGIN, type Provider } from "#test/rpc/harness.ts";

function upgradeable(request: Request, socket: Socket.Socket) {
	return new Proxy(HttpServerRequest.fromWeb(request), {
		get: (target, key, receiver) => (key === "upgrade" ? Effect.succeed(socket) : Reflect.get(target, key, receiver)),
	});
}

export function overWebSocket<A, E>(
	provider: Provider,
	origin: OriginPolicy,
	upgradeHeaders: Readonly<Record<string, string>>,
	run: (client: ApiClient) => Effect.Effect<A, E>,
) {
	return Effect.gen(function* () {
		const toServer = new TransformStream<Uint8Array, Uint8Array>();
		const toClient = new TransformStream<Uint8Array, Uint8Array>();
		const serverSocket = yield* Socket.fromTransformStream(Effect.succeed({ readable: toServer.readable, writable: toClient.writable }));
		const clientSocket = yield* Socket.fromTransformStream(Effect.succeed({ readable: toClient.readable, writable: toServer.writable }));
		const { protocol, httpEffect } = yield* RpcServer.makeProtocolWithHttpEffectWebsocket;
		yield* Effect.forkScoped(Effect.provideService(RpcServer.make(Api), RpcServer.Protocol, protocol));
		const request = upgradeable(new Request(`${ORIGIN}/rpc`, { headers: upgradeHeaders }), serverSocket);
		yield* Effect.forkScoped(Effect.provideService(httpEffect, HttpServerRequest.HttpServerRequest, request));
		return yield* Effect.gen(function* () {
			const client = yield* RpcClient.make(Api);
			return yield* Effect.result(run(client));
		}).pipe(Effect.provide(RpcClient.layerProtocolSocket().pipe(Layer.provide(Layer.succeed(Socket.Socket, clientSocket)))));
	}).pipe(Effect.provide(serverLayer(provider, origin)), Effect.provide(RpcSerialization.layerJson), Effect.scoped);
}
