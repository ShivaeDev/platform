import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { type Rpc, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { Activity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import type { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { browserReads } from "@shivaedev/test-story/server/browserReads.ts";
import { Notes } from "#modules/notes/notes.ts";

export const notesClientHost = Effect.fnUntraced(function* (
	handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<typeof Notes.application>>>,
	authentication: Layer.Layer<AuthenticatedUser>,
	services: Layer.Layer<Reactivity.Reactivity>,
) {
	const live = liveServerLayer.pipe(Layer.provideMerge(services));
	const changes = hostChanges(Notes).pipe(Layer.provide(handlers), Layer.provide(live));
	const routes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, changes, authentication, RpcSerialization.layerNdjson]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP notes host");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	const observed = yield* browserReads({ contracts: [Notes], url, webSocketConstructor: layerWebSocketConstructor });
	const client = makeClient(Notes, { protocol: observed.protocol, url });
	return { api: client.api, observed, runtime: client.runtime, [Activity]: clientActivity(client) };
});
