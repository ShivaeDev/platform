import { Context, Deferred, Duration, Effect, Layer, Path, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/server/appHost.ts";
import { workRpcs } from "#rpc/contract.ts";
import type { Server } from "#rpc/Server.ts";
import type { BoardOptions } from "#server/board.ts";
import { boardRuntime } from "#server/boardRuntime.ts";
import { boardSocket } from "#server/boardSocket.ts";
import { boardRoutes } from "#server/http/boardRoutes.ts";
import { MAX_BYTES, RPC_PATH, rpcPolicy } from "#server/http/rpcPolicy.ts";
import { Highlighter } from "#server/render/Highlighter.ts";

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
			const handlers = runtime.rpcHandlers;
			const listeners = yield* Scope.fork(yield* Scope.Scope, "parallel");
			const socketScope = yield* Scope.fork(listeners, "sequential");
			yield* boardSocket(directory, handlers, options.drainRequests).pipe(Scope.provide(socketScope));
			const httpScope = yield* Scope.fork(listeners, "sequential");
			const host = yield* Layer.buildWithScope(
				appHost({
					config: {
						disablePreemptiveShutdown: options.drainRequests !== true,
						gracefulShutdownTimeout: Duration.seconds(5),
						host: HOST,
						maxBodySize: 4 * MAX_BYTES + 4096,
						port: options.port,
					},
					group: workRpcs,
					handlers,
					policy: "loopback",
					routes: Layer.merge(boardRoutes(options, runtime), rpcPolicy),
					rpcPath: RPC_PATH,
					services: runtime.live,
				}),
				httpScope,
			);
			const { address } = Context.get(host, HttpServer.HttpServer);
			if (!NetAddress.isInetAddress(address)) {
				return yield* Effect.die(new Error("The board browser server did not listen on TCP."));
			}
			yield* Deferred.succeed(info, { directory, url: `http://${HOST}:${address.port}/` });
			return Layer.succeedContext(host);
		}),
	).pipe(Layer.provide(Highlighter.layer));
}
