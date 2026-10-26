import { Context, Deferred, Duration, Effect, Layer, Path, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/server/appHost.ts";
import { workContract, workRpcs } from "#rpc/contract.ts";
import type { Server } from "#rpc/Server.ts";
import { boardRuntime } from "#server/boardRuntime.ts";
import { boardRoutes } from "#server/http/boardRoutes.ts";
import { MAX_BYTES, RPC_PATH, rpcPolicy } from "#server/http/rpcPolicy.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { BoardOptions } from "./board.ts";
import { boardSocket } from "./boardSocket.ts";

export const HOST = "127.0.0.1";

export interface ServeOptions extends BoardOptions {
	readonly drainRequests?: boolean;
	readonly port: number;
}

export function serveBoard(options: ServeOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const directory = (yield* Path.Path).resolve(options.root);
			const info = yield* Deferred.make<typeof Server.Type>();
			const runtime = yield* boardRuntime(options, Deferred.await(info));
			const stopping = yield* Deferred.make<void>();
			const subscriptions = workContract.toLayerHandler(
				"work-board.subscribe",
				Effect.gen(function* () {
					const handler = yield* workContract.accessHandler("work-board.subscribe");
					return (payload, request) => {
						const result = handler(payload, request);
						const stream = Stream.isStream(result) ? result : Stream.unwrap(result.pipe(Effect.map(Stream.fromQueue)));
						return stream.pipe(Stream.interruptWhen(Deferred.await(stopping)));
					};
				}),
			);
			const handlers = Layer.succeedContext(yield* Layer.build(subscriptions.pipe(Layer.provideMerge(runtime.rpcHandlers))));
			yield* boardSocket(directory, handlers, options.drainRequests);
			const host = yield* Layer.build(
				appHost({
					config: {
						disablePreemptiveShutdown: options.drainRequests !== true,
						gracefulShutdownTimeout: Duration.infinity,
						host: HOST,
						maxBodySize: 4 * MAX_BYTES + 4096,
						port: options.port,
					},
					group: workRpcs,
					handlers,
					policy: "loopback",
					routes: Layer.merge(boardRoutes(options, runtime), rpcPolicy),
					rpcPath: RPC_PATH,
					services: Layer.empty,
				}),
			);
			yield* Effect.addFinalizer(() => Deferred.succeed(stopping, undefined));
			const { address } = Context.get(host, HttpServer.HttpServer);
			if (!NetAddress.isInetAddress(address)) {
				return yield* Effect.die(new Error("The board browser server did not listen on TCP."));
			}
			yield* Deferred.succeed(info, { directory, url: `http://${HOST}:${address.port}/` });
			return Layer.succeedContext(host);
		}),
	).pipe(Layer.provide(Highlighter.layer));
}
