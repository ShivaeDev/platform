import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { DAEMON_RPC_PATH, DiagnosticsContract, type DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";

export const diagnosticsDaemon = Effect.fn("Test.diagnosticsDaemon")(function* (
	read: () => DiagnosticsSnapshot,
	port = 0,
	items: () => FleetItems = () => ({ completed: [], items: [] }),
) {
	const handlers = DiagnosticsContract.toLayer({ "daemon.diagnostics": () => Effect.sync(read), "daemon.fleetItems": () => Effect.sync(items) });
	const rpc = RpcServer.layerHttp({ group: DiagnosticsContract, path: DAEMON_RPC_PATH, protocol: "http" }).pipe(
		Layer.provide([handlers, RpcSerialization.layerNdjson]),
	);
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(
		HttpRouter.serve(rpc, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: "127.0.0.1", port })),
		),
		scope,
	);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		throw new Error("Expected a TCP daemon");
	}
	return { port: server.address.port, stop: () => Scope.close(scope, Exit.void) };
});
