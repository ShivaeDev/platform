import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Context, Effect, Layer, Option } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { authSession as readSession } from "@shivaedev/identity/client/adapters/authSession.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissionLayer.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { liveHost } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { authSession } from "#client/authSession.ts";
import { Notes, ReadPermission, type Role, Roles } from "#test/permission-routes/feature.ts";

export const openHost = Effect.fnUntraced(function* (initial: Role | undefined) {
	const requests: string[] = [];
	const state = { role: initial };
	const sessions = {
		origin: () => true,
		provider: {
			get: () =>
				Effect.sync(() =>
					state.role === undefined
						? Option.none()
						: Option.some({ user: { email: "alice@example.test", id: "alice", name: "Alice", role: state.role } }),
				),
		},
		roles: Roles,
	};
	const handlers = Notes.application.toLayer({
		"permissionNotes.get": ({ id }) =>
			id === "offline" ? Effect.fail(new ServiceUnavailable({ message: "Query service unavailable" })) : Effect.succeed(`Note ${id}`),
	});
	const host = yield* liveHost(Notes, handlers);
	const routes = RpcServer.layerHttp({ group: host.group, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([host.handlers, permissionLayer(ReadPermission), RpcSerialization.layerNdjson]),
		Layer.provide(Layer.succeed(SessionPolicy, sessions)),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(
				NodeHttpServer.layer(
					() => {
						const server = createServer();
						server.on("upgrade", (request) => {
							requests.push(`${request.method} ${request.url}`);
						});
						return server;
					},
					{ host: "127.0.0.1", port: 0 },
				),
			),
		),
	);
	const { address } = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die(new Error("Expected a TCP host"));
	}
	const url = `http://127.0.0.1:${address.port}/rpc`;
	const { api } = makeRpcClient(Notes, { url, webSocketConstructor: layerWebSocketConstructor });
	return {
		api,
		readSession: (role: Role) =>
			authSession(
				readSession(
					async (_signal): Promise<{ data: { user: { id: string } }; error: null }> => ({
						data: { user: { id: "alice", ...(await Effect.runPromise(Roles.resolve(role))) } },
						error: null,
					}),
				),
			),
		requests,
		state,
		url,
	};
});
export type Host = Effect.Success<ReturnType<typeof openHost>>;
