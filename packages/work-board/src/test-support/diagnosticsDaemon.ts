import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Exit, Layer, Schema, Scope } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcSerialization, RpcServer } from "effect/rpc";
import type { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { DAEMON_RPC_PATH, DiagnosticsContract } from "#diagnostics/daemonContract.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";

export const diagnosticsDaemon = Effect.fn("Test.diagnosticsDaemon")(function* (
	read: () => unknown,
	port = 0,
	items: (() => FleetItems) | Effect.Effect<FleetItems, ServiceUnavailable> = () => ({ completed: [], items: [] }),
) {
	const protocol = DiagnosticsContract.omit("daemon.diagnostics").add(Rpc.make("daemon.diagnostics", { payload: {}, success: Schema.Unknown }));
	const handlers = protocol.toLayer({
		"daemon.diagnostics": () => Effect.sync(read),
		"daemon.fleetItems": () => (typeof items === "function" ? Effect.sync(items) : items),
	});
	const rpc = RpcServer.layerHttp({ group: protocol, path: DAEMON_RPC_PATH, protocol: "http" }).pipe(
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
