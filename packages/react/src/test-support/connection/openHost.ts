import { createServer } from "node:http";
import type { Socket } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Deferred, Effect, Layer, Queue, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { Api, Notes, Summary } from "./feature.ts";

export const openHost = Effect.gen(function* () {
	const sockets = new Set<Socket>();
	const closed = yield* Queue.unbounded<void>();
	const waiting = yield* Deferred.make<void>();
	const released = yield* Deferred.make<void>();
	const state = { hold: false, refused: false, title: "One" };
	const gate = HttpRouter.middleware((request) =>
		Effect.gen(function* () {
			if (state.hold) {
				yield* Deferred.succeed(waiting, undefined);
				yield* Deferred.await(released);
			}
			return yield* request;
		}),
	);
	function updates(value: () => string) {
		return Stream.suspend(() =>
			Stream.concat(
				Stream.succeed(
					state.refused
						? new QueryReadDenied({ message: "Private note" })
						: { _tag: "Result" as const, query: "get" as const, queryIndex: 0, value: value() },
				),
				Stream.never,
			),
		).pipe(Stream.ensuring(Queue.offer(closed, undefined)));
	}
	const handlers = Layer.merge(
		Notes.toLayer({
			"connectionNotes.$changes": () => updates(() => state.title),
			"connectionNotes.get": () => Effect.succeed(state.title),
		}),
		Summary.toLayer({
			"connectionSummary.$changes": () => updates(() => "Summary"),
			"connectionSummary.get": () => Effect.succeed("Summary"),
		}),
	);
	const routes = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, RpcSerialization.layerNdjson, gate.layer]),
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
	yield* Effect.addFinalizer(() => Deferred.succeed(released, undefined));
	const { address } = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die(new Error("Expected TCP host"));
	}
	return {
		closed,
		drop: Effect.sync(() => {
			state.hold = true;
			for (const socket of sockets) {
				socket.destroy();
			}
		}),
		restore: Deferred.succeed(released, undefined),
		state,
		url: `http://127.0.0.1:${address.port}/rpc`,
		waiting: Deferred.await(waiting),
	};
});
