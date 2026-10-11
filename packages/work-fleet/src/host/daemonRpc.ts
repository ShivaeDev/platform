import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { requestTracingLayer } from "@shivaedev/platform/rpc-server/tracing.ts";
import { DaemonContract, RPC_PATH } from "#host/daemonContract.ts";
import { fleetHandlers } from "#operations.ts";

function localRequest(request: HttpServerRequest.HttpServerRequest) {
	const host = request.headers.host;
	if (host === undefined) {
		return false;
	}
	try {
		const url = new URL(`http://${host}`);
		return (
			["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && (request.headers.origin === undefined || request.headers.origin === url.origin)
		);
	} catch {
		return false;
	}
}

export const daemonRpc = HttpRouter.use((router) =>
	Effect.gen(function* () {
		const handler = yield* RpcServer.toHttpEffect(DaemonContract).pipe(
			Effect.provide(Layer.mergeAll(fleetHandlers, requestTracingLayer(), RpcSerialization.layerNdjson)),
		);
		yield* router.add("POST", RPC_PATH, (request) =>
			localRequest(request) && request.headers["content-type"]?.split(";")[0] === "application/ndjson"
				? handler.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request))
				: Effect.succeed(HttpServerResponse.text("Local same-origin NDJSON requests only", { status: 403 })),
		);
	}),
);
