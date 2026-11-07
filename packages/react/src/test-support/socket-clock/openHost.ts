import { createServer } from "node:http";
import type { Socket } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Clock, Context, Deferred, Effect, Layer, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { EditExpired, Notes } from "#test/socket-clock/feature.ts";

export const openHost = Effect.gen(function* () {
	const waiting = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const sockets = new Set<Socket>();
	const state = { handshakes: 0, hold: false };
	const expiresAt = (yield* Clock.currentTimeMillis) + 30_000;
	const gate = HttpRouter.middleware((httpEffect) =>
		Effect.gen(function* () {
			state.handshakes += 1;
			if (state.hold) {
				yield* Deferred.succeed(waiting, undefined);
				yield* Deferred.await(release);
			}
			return yield* httpEffect;
		}),
	);
	const handlers = Notes.toLayer({
		"socketClockNotes.$changes": () => Stream.never,
		"socketClockNotes.save": () =>
			Effect.gen(function* () {
				return (yield* Clock.currentTimeMillis) >= expiresAt
					? yield* Effect.fail(new EditExpired({ message: "The edit window has closed" }))
					: "Saved";
			}),
	});
	const routes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "websocket" }).pipe(
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
		}).pipe(Effect.andThen(Deferred.succeed(release, undefined))),
	);
	const { address } = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die(new Error("Expected a TCP host"));
	}
	return {
		disconnect: () =>
			Effect.sync(() => {
				state.hold = true;
				for (const socket of sockets) {
					socket.destroy();
				}
			}),
		release: Effect.sync(() => {
			state.hold = false;
		}).pipe(Effect.andThen(Deferred.succeed(release, undefined))),
		silence: Effect.sync(() => {
			for (const socket of sockets) {
				socket.pause();
			}
		}),
		state,
		url: `http://127.0.0.1:${address.port}/rpc`,
		waiting: Deferred.await(waiting),
	};
});
