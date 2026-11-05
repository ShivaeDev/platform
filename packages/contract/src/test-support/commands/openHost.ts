import { createServer } from "node:http";
import type { Socket } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Deferred, Effect, Layer, Queue, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { Counter } from "./Counter.ts";

export const openHost = Effect.gen(function* () {
	const sockets = new Set<Socket>();
	const waiting = yield* Queue.unbounded<void>();
	const executed = yield* Queue.unbounded<number>();
	const released = yield* Deferred.make<void>();
	const state = { handshakes: 0, hold: false, holdResponse: false, value: 0 };
	const gate = HttpRouter.middleware((request) =>
		Effect.gen(function* () {
			state.handshakes += 1;
			if (state.hold) {
				yield* Queue.offer(waiting, undefined);
				yield* Deferred.await(released);
			}
			return yield* request;
		}),
	);
	const handlers = Counter.toLayer({
		"counter.$changes": () => Stream.never,
		"counter.add": ({ amount }) =>
			Effect.gen(function* () {
				state.value += amount;
				yield* Queue.offer(executed, state.value);
				if (state.holdResponse) {
					yield* Effect.never;
				}
				return state.value;
			}),
		"counter.value": () => Effect.succeed(state.value),
	});
	const routes = RpcServer.layerHttp({ group: Counter, path: "/rpc", protocol: "websocket" }).pipe(
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
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			for (const socket of sockets) {
				socket.destroy();
			}
		}).pipe(Effect.andThen(Deferred.succeed(released, undefined))),
	);
	const { address } = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Expected TCP host");
	}
	return {
		drop: Effect.sync(() => {
			state.hold = true;
			for (const socket of sockets) {
				socket.destroy();
			}
		}),
		executed,
		restore: Effect.sync(() => {
			state.hold = false;
		}).pipe(Effect.andThen(Deferred.succeed(released, undefined))),
		silence: Effect.sync(() => {
			for (const socket of sockets) {
				socket.pause();
			}
		}),
		state,
		url: `http://127.0.0.1:${address.port}/rpc`,
		waiting: Queue.take(waiting),
	};
});
