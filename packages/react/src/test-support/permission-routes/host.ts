import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Layer, Option, Stream } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import { Notes, ReadPermission, type Role, Roles } from "./feature.ts";

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
	const handlers = Notes.toLayer({
		"permissionNotes.$changes": () => Stream.never,
		"permissionNotes.get": ({ id }) => Effect.succeed(`Note ${id}`),
	});
	const routes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, permissionLayer(ReadPermission, sessions), RpcSerialization.layerJson]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(
				NodeHttpServer.layer(
					() => {
						const server = createServer();
						server.on("request", (request) => {
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
	class Client extends AtomRpc.Service<Client>()("test/PermissionRoutes", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
	}) {}
	return {
		api: bind(Notes, Client),
		payload: (role: Role) => Effect.map(Roles.resolve(role), (access) => ({ user: { id: "alice", ...access } })),
		requests,
		state,
		url,
	};
});
export type Host = Effect.Success<ReturnType<typeof openHost>>;
