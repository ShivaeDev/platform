import { Effect } from "effect";
import { HttpServerRequest } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { Socket } from "effect/unstable/socket";
import { expect, test } from "vitest";
import { trustedOrigins } from "../src/rpc-server.ts";
import { Api, serverLayer } from "./rpc/api.ts";
import { createProvider, origin, type Provider, signup } from "./rpc/support.ts";

const upgradeable = (request: Request, socket: Socket.Socket) =>
	new Proxy(HttpServerRequest.fromWeb(request), {
		get: (target, key, receiver) => (key === "upgrade" ? Effect.succeed(socket) : Reflect.get(target, key, receiver)),
	});

const whoamiOverWebSocket = (provider: Provider, transport: Readonly<Record<string, string>>, message: ReadonlyArray<readonly [string, string]>) => {
	const inbound = new TransformStream<string, string>();
	const outbound = new TransformStream<Uint8Array, Uint8Array>();
	return Effect.runPromise(
		Effect.gen(function* () {
			const socket = yield* Socket.fromTransformStream(Effect.succeed({ readable: inbound.readable, writable: outbound.writable }));
			const { protocol, httpEffect } = yield* RpcServer.makeProtocolWithHttpEffectWebsocket;
			yield* Effect.forkScoped(Effect.provideService(RpcServer.make(Api), RpcServer.Protocol, protocol));
			const request = upgradeable(new Request(`${origin}/rpc`, { headers: transport }), socket);
			yield* Effect.forkScoped(Effect.provideService(httpEffect, HttpServerRequest.HttpServerRequest, request));
			const writer = inbound.writable.getWriter();
			const reader = outbound.readable.getReader();
			yield* Effect.promise(() => writer.write(JSON.stringify({ _tag: "Request", headers: message, id: "1", payload: null, tag: "Whoami" })));
			const { value } = yield* Effect.promise(() => reader.read());
			return new TextDecoder().decode(value);
		}).pipe(
			Effect.provide(serverLayer(provider, trustedOrigins({ allow: [origin], missing: "reject" }))),
			Effect.provide(RpcSerialization.layerJson),
			Effect.scoped,
		),
	);
};

test("WebSocket RPC decides origin and session from the upgrade request, not message headers", async () => {
	const provider = await createProvider();
	try {
		const alice = await signup(provider, "alice");
		expect(await whoamiOverWebSocket(provider, { cookie: alice.cookie, origin }, [])).toContain(alice.userId);
		const hijack = await whoamiOverWebSocket(provider, { cookie: alice.cookie, origin: "https://attacker.example" }, [["origin", origin]]);
		expect(hijack).toMatch(/"_tag":"Forbidden".*"Origin not allowed"/u);
		expect(await whoamiOverWebSocket(provider, { origin }, [["cookie", alice.cookie]])).toContain('"_tag":"Unauthorized"');
	} finally {
		provider.database.close();
	}
}, 20_000);
