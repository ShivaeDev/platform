import { createServer } from "node:http";
import type { Socket } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Deferred, Effect, Layer, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { EditExpired, Notes } from "./feature.ts";

export const openHost = Effect.gen(function* () {
	const waiting = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const sockets = new Set<Socket>();
	const state = { expired: false, handshakes: 0, hold: false };
	yield* Effect.sleep("30 seconds").pipe(
		Effect.andThen(
			Effect.sync(() => {
				state.expired = true;
			}),
		),
		Effect.forkScoped,
	);
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
			state.expired ? Effect.fail(new EditExpired({ message: "The edit window has closed" })) : Effect.succeed("Saved"),
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
		release: Deferred.succeed(release, undefined),
		state,
		url: `http://127.0.0.1:${address.port}/rpc`,
		waiting: Deferred.await(waiting),
	};
});
