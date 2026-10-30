import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import type { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { type Brief, type BriefRefusal, DAEMON_RPC_PATH, DaemonReadContract, type DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";

export function diagnosticsDaemon(read: () => DiagnosticsSnapshot, port?: number, items?: Parameters<typeof rawDiagnosticsDaemon>[2]) {
	return rawDiagnosticsDaemon(read, port, items);
}

export const rawDiagnosticsDaemon = Effect.fn("Test.rawDiagnosticsDaemon")(function* (
	read: () => unknown,
	port = 0,
	items: (() => FleetItems) | Effect.Effect<FleetItems, ServiceUnavailable> = () => ({ completed: [], items: [] }),
	briefProblems: (briefs: readonly Brief[]) => readonly BriefRefusal[] = () => [],
) {
	const handlers = DaemonReadContract.application.toLayer({
		"daemon.briefProblems": ({ briefs }) => Effect.sync(() => briefProblems(briefs)),
		"daemon.diagnostics": () => Effect.sync(read),
		"daemon.fleetItems": () => (typeof items === "function" ? Effect.sync(items) : items),
	});
	const rpc = RpcServer.layerHttp({ group: DaemonReadContract.application, path: DAEMON_RPC_PATH, protocol: "http" }).pipe(
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
