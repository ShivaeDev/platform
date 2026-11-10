import { createServer } from "node:http";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Config, type Duration, Effect, Layer, Scope } from "effect";
import { HttpServer } from "effect/http";
import { unixHttpServer } from "#adapters/unixHttpServer.ts";
import { hostHttpServices } from "#hostHttpServices.ts";

export function nodeHttpServer(
	host: string,
	config?: {
		readonly port?: number;
		readonly socketPath?: string;
		readonly gracefulShutdownTimeout?: Duration.Input;
		readonly disablePreemptiveShutdown?: boolean;
		readonly maxBodySize?: number;
	},
) {
	return Layer.effect(
		HttpServer.HttpServer,
		Effect.gen(function* () {
			const socketPath = config?.socketPath;
			const options = {
				gracefulShutdownTimeout: config?.gracefulShutdownTimeout,
				websocket: config?.maxBodySize === undefined ? undefined : { maxPayload: socketPayloadLimit(config.maxBodySize) },
				...(config?.disablePreemptiveShutdown === undefined ? {} : { disablePreemptiveShutdown: config.disablePreemptiveShutdown }),
			};
			if (socketPath === undefined) {
				const port = config?.port ?? (yield* Config.Int("PORT").pipe(Config.withDefault(3000)));
				return yield* NodeHttpServer.make(createServer, { ...options, host, port });
			}
			const listeners = yield* Scope.fork(yield* Scope.Scope, "parallel");
			const socketScope = yield* Scope.fork(listeners, "sequential");
			const unix = yield* unixHttpServer(socketPath, options).pipe(Scope.provide(socketScope));
			// Socket preparation emits filesystem events; keep TCP closed until it finishes.
			const tcpScope = yield* Scope.fork(listeners, "sequential");
			const tcp =
				config?.port === undefined
					? undefined
					: yield* NodeHttpServer.make(createServer, {
							...options,
							host,
							port: config.port,
						}).pipe(Scope.provide(tcpScope));
			return HttpServer.make({
				address: tcp?.address ?? unix.address,
				serve: (handler, middleware) =>
					Effect.gen(function* () {
						const servingListeners = yield* Scope.fork(yield* Scope.Scope, "parallel");
						const unixServing = yield* Scope.fork(servingListeners, "sequential");
						yield* (middleware === undefined ? unix.serve(handler) : unix.serve(handler, middleware)).pipe(Scope.provide(unixServing));
						if (tcp !== undefined) {
							const serving = yield* Scope.fork(servingListeners, "sequential");
							yield* (middleware === undefined ? tcp.serve(handler) : tcp.serve(handler, middleware)).pipe(Scope.provide(serving));
						}
					}),
			});
		}),
	).pipe(Layer.provideMerge(hostHttpServices));
}

function socketPayloadLimit(bytes: number) {
	// ws truncates maxPayload to a signed 32-bit integer; the RPC reader covers zero and larger limits.
	return bytes > 0x7f_ff_ff_ff ? 0 : Math.max(1, bytes);
}
