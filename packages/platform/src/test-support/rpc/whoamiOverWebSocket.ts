import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { Socket } from "effect/socket";
import type { OriginPolicy } from "#server/rpc-server/origin.ts";
import { Api, serverLayer } from "#test/rpc/api.ts";
import { ORIGIN, type Provider } from "#test/rpc/harness.ts";

function upgradeable(request: Request, socket: Socket.Socket) {
	return new Proxy(HttpServerRequest.fromWeb(request), {
		get: (target, key, receiver) => (key === "upgrade" ? Effect.succeed(socket) : Reflect.get(target, key, receiver)),
	});
}
export function whoamiOverWebSocket(
	provider: Provider,
	origin: OriginPolicy,
	transport: Readonly<Record<string, string>>,
	message: ReadonlyArray<readonly [string, string]>,
) {
	return Effect.gen(function* () {
		const inbound = new TransformStream<string, string>();
		const outbound = new TransformStream<Uint8Array, Uint8Array>();
		const socket = yield* Socket.fromTransformStream(Effect.succeed({ readable: inbound.readable, writable: outbound.writable }));
		const { protocol, httpEffect } = yield* RpcServer.makeProtocolWithHttpEffectWebsocket;
		yield* Effect.forkScoped(Effect.provideService(RpcServer.make(Api), RpcServer.Protocol, protocol));
		const request = upgradeable(new Request(`${ORIGIN}/rpc`, { headers: transport }), socket);
		yield* Effect.forkScoped(Effect.provideService(httpEffect, HttpServerRequest.HttpServerRequest, request));
		const writer = inbound.writable.getWriter();
		const reader = outbound.readable.getReader();
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				writer.releaseLock();
				reader.releaseLock();
			}),
		);
		yield* Effect.promise(() => writer.write(JSON.stringify({ _tag: "Request", headers: message, id: "1", payload: null, tag: "Whoami" })));
		const { value } = yield* Effect.promise(() => reader.read());
		return new TextDecoder().decode(value);
	}).pipe(Effect.provide(serverLayer(provider, origin)), Effect.provide(RpcSerialization.layerJson));
}
