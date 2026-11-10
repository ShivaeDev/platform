import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Context, Deferred, Effect, Layer, Queue, Ref } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Rpc, RpcGroup } from "effect/rpc";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { trackedSockets } from "#server/adapters/trackedSockets.ts";

export const rpcSocketHost = Effect.fnUntraced(function* <TRpcs extends Rpc.Any, E, R>(
	group: RpcGroup.RpcGroup<TRpcs>,
	handlers: Layer.Layer<Rpc.ToHandler<TRpcs> | Rpc.Middleware<TRpcs>, E, R>,
) {
	const sockets = trackedSockets();
	const holding = yield* Ref.make<Deferred.Deferred<void> | undefined>(undefined);
	const refusing = yield* Ref.make(false);
	const count = yield* Ref.make(0);
	const arrived = yield* Queue.unbounded<void>();
	const held = yield* Queue.unbounded<void>();
	const accept = Effect.gen(function* () {
		yield* Ref.set(refusing, false);
		const release = yield* Ref.getAndSet(holding, undefined);
		if (release !== undefined) {
			yield* Deferred.succeed(release, undefined);
		}
	});
	const gate = HttpRouter.middleware((request) =>
		Effect.gen(function* () {
			yield* Ref.update(count, (handshakes) => handshakes + 1);
			yield* Queue.offer(arrived, undefined);
			if (yield* Ref.get(refusing)) {
				return HttpServerResponse.empty({ status: HttpStatus.fromLiteral("ServiceUnavailable") });
			}
			const release = yield* Ref.get(holding);
			if (release !== undefined) {
				yield* Queue.offer(held, undefined);
				yield* Deferred.await(release);
			}
			return yield* request;
		}),
	);
	const routes = RpcServer.layerHttp({ group, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, RpcSerialization.layerNdjson, gate.layer]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(() => sockets.server, { host: "127.0.0.1", port: 0 })),
		),
	);
	yield* Effect.addFinalizer(() => Effect.sync(sockets.destroy).pipe(Effect.andThen(accept)));
	return {
		accept,
		drop: Effect.sync(sockets.destroy),
		handshakes: Ref.get(count),
		held: Queue.take(held),
		hold: Effect.gen(function* () {
			const release = yield* Deferred.make<void>();
			yield* Ref.update(holding, (current) => current ?? release);
		}),
		nextHandshake: Queue.take(arrived),
		pause: Effect.sync(sockets.pause),
		refuse: accept.pipe(Effect.andThen(Ref.set(refusing, true))),
		url: `${HttpServer.formatAddress(Context.get(context, HttpServer.HttpServer).address)}/rpc`,
	};
});
