import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { DAEMON_RPC_PATH, DiagnosticsContract, type DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import { listenOn } from "#serve.ts";

export const diagnosticsDaemon = Effect.fn("Test.diagnosticsDaemon")(function* (read: () => DiagnosticsSnapshot, port = 0) {
	const handlers = DiagnosticsContract.toLayer({ "daemon.diagnostics": () => Effect.sync(read) });
	const rpc = RpcServer.layerHttp({ group: DiagnosticsContract, path: DAEMON_RPC_PATH, protocol: "http" }).pipe(
		Layer.provide([handlers, RpcSerialization.layerNdjson]),
	);
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(HttpRouter.serve(rpc, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(port))), scope);
	const server = Context.get(context, HttpServer.HttpServer);
	if (server.address._tag !== "TcpAddress") {
		throw new Error("Expected a TCP daemon");
	}
	return { port: server.address.port, stop: () => Scope.close(scope, Exit.void) };
});
