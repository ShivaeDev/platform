import { createServer } from "node:http";
import type { Socket } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Layer, Queue, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { Accounts, SessionGuard } from "./feature.ts";

export const openHost = Effect.gen(function* () {
	const handshakes = yield* Queue.unbounded<string>();
	const sockets = new Set<Socket>();
	const state: { authorized: boolean; failures: string[]; reachable: boolean; reads: string[] } = {
		authorized: true,
		failures: [],
		reachable: true,
		reads: [],
	};
	const gate = HttpRouter.middleware((http) =>
		Effect.suspend(() => {
			Queue.offerUnsafe(handshakes, state.reachable ? "reachable" : "unreachable");
			return state.reachable ? http : Effect.succeed(HttpServerResponse.empty({ status: 503 }));
		}),
	);
	const guard = Layer.succeed(SessionGuard, (next) =>
		Effect.suspend(() => {
			if (!state.authorized) {
				state.failures.push("signed out");
				return Effect.fail(new Unauthorized({ message: "Session ended" }));
			}
			return next;
		}),
	);
	const application = Accounts.application.toLayer({
		"reconnectAccounts.get": ({ page }) =>
			Effect.sync(() => {
				state.reads.push(page);
				return "Alice's account";
			}),
	});
	const changes = changesHandlerLayer(Accounts, () =>
		Effect.map(
			makeLiveServer,
			(live) =>
				({ queries }, options) =>
					Stream.unwrap(
						Effect.gen(function* () {
							const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
							return live.subscribe(subscription, rerunQuery(Accounts.application, options));
						}),
					),
		),
	);
	const handlers = Layer.merge(application, changes.pipe(Layer.provide(application))).pipe(Layer.provide(Reactivity.layer));
	const routes = RpcServer.layerHttp({ group: Accounts, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, guard, RpcSerialization.layerNdjson, gate.layer]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(
				NodeHttpServer.layer(
					() => {
						const server = createServer();
						server.on("connection", (socket) => {
							sockets.add(socket);
							socket.on("close", () => sockets.delete(socket));
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
	return {
		drop: () =>
			Effect.sync(() => {
				for (const socket of sockets) {
					socket.destroy();
				}
			}),
		handshakes,
		state,
		url: `http://127.0.0.1:${address.port}/rpc`,
	};
});
