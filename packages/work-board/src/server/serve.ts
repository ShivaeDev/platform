import { Effect, Layer } from "effect";
import { appHost } from "@shivaedev/platform/appHost.ts";
import { workRpcs } from "#rpc/contract.ts";
import { boardRuntime } from "#server/boardRuntime.ts";
import { boardRoutes } from "#server/http/boardRoutes.ts";
import { MAX_BYTES, RPC_PATH, rpcPolicy } from "#server/http/rpcPolicy.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import type { BoardOptions } from "./board.ts";

export const HOST = "127.0.0.1";

export interface ServeOptions extends BoardOptions {
	readonly port: number;
}

export function serveBoard(options: ServeOptions) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const runtime = yield* boardRuntime(options);
			return appHost({
				config: { disablePreemptiveShutdown: true, host: HOST, maxBodySize: 4 * MAX_BYTES + 4096, port: options.port },
				group: workRpcs,
				handlers: runtime.rpcHandlers,
				policy: "loopback",
				routes: Layer.merge(boardRoutes(options, runtime), rpcPolicy),
				rpcPath: RPC_PATH,
				services: Layer.empty,
			});
		}),
	).pipe(Layer.provide(Highlighter.layer));
}
