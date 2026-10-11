import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";
import { requestTracingLayer } from "@shivaedev/platform/rpc-server/tracing.ts";
import type { FleetHost } from "#host/config.ts";
import { DaemonContract, RPC_PATH } from "#host/daemonContract.ts";
import { daemonHandlers } from "#host/daemonHandlers.ts";
import { fleetHandlers } from "#operations.ts";

export function daemonRpc(host: FleetHost) {
	return HttpRouter.use((router) =>
		Effect.gen(function* () {
			const clientHandlers = yield* daemonHandlers(host);
			const handler = yield* RpcServer.toHttpEffect(DaemonContract).pipe(
				Effect.provide(Layer.mergeAll(fleetHandlers, clientHandlers, requestTracingLayer(), RpcSerialization.layerNdjson)),
			);
			yield* router.add("POST", RPC_PATH, (request) =>
				localRpcGuard(handler).pipe(
					Effect.provideService(HttpServerRequest.HttpServerRequest, request),
					Effect.provide(RpcSerialization.layerNdjson),
				),
			);
		}),
	);
}
