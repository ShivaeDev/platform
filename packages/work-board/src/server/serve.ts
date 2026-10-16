import { Context, Deferred, Effect, Layer, Path } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { appHost } from "@shivaedev/platform/appHost.ts";
import { workRpcs } from "#rpc/contract.ts";
import type { Server } from "#rpc/Server.ts";
import { boardRuntime } from "#server/boardRuntime.ts";
import { MAX_BYTES } from "#server/history/limits.ts";
import { boardRoutes } from "#server/http/boardRoutes.ts";
import { RPC_PATH, rpcPolicy } from "#server/http/rpcPolicy.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { BoardOptions } from "./board.ts";
import { boardSocket } from "./boardSocket.ts";

export const HOST = "127.0.0.1";

export interface ServeOptions extends BoardOptions {
	readonly port: number;
}

export function serveBoard(options: ServeOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const directory = (yield* Path.Path).resolve(options.root);
			const info = yield* Deferred.make<typeof Server.Type>();
			const runtime = yield* boardRuntime(options, Deferred.await(info));
			const handlers = Layer.succeedContext(yield* Layer.build(runtime.rpcHandlers));
			yield* boardSocket(directory, handlers);
			const host = yield* Layer.build(
				appHost({
					config: { disablePreemptiveShutdown: true, host: HOST, maxBodySize: 4 * MAX_BYTES + 4096, port: options.port },
					group: workRpcs,
					handlers,
					policy: "loopback",
					routes: Layer.merge(boardRoutes(options, runtime), rpcPolicy),
					rpcPath: RPC_PATH,
					services: Layer.empty,
				}),
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
