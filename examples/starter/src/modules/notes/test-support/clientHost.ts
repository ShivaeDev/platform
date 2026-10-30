import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { type Rpc, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { browserReads } from "@shivaedev/test-story/server/browserReads.ts";
import { Notes } from "#modules/notes/notes.ts";

export const notesClientHost = Effect.fnUntraced(function* (
	handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<typeof Notes>>>,
	authentication: Layer.Layer<AuthenticatedUser>,
) {
	const routes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, authentication, RpcSerialization.layerNdjson]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP notes host");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	const observed = yield* browserReads({ contracts: [Notes], url, webSocketConstructor: layerWebSocketConstructorWS });
	const { api, runtime } = makeClient(Notes, { protocol: observed.protocol, url });
	return { api, observed, runtime };
});
