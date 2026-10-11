import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { DAEMON_RPC_PATH, DiagnosticsContract, type DiagnosticsSnapshot } from "#diagnostics/daemonContract.ts";
import { listenOn } from "#serve.ts";

export async function diagnosticsDaemon(read: () => DiagnosticsSnapshot, port = 0) {
	const handlers = DiagnosticsContract.toLayer({ "daemon.diagnostics": () => Effect.sync(read) });
	const rpc = RpcServer.layerHttp({ group: DiagnosticsContract, path: DAEMON_RPC_PATH, protocol: "http" }).pipe(
		Layer.provide([handlers, RpcSerialization.layerNdjson]),
	);
	const runtime = ManagedRuntime.make(HttpRouter.serve(rpc, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(port))));
	const server = await runtime.runPromise(Effect.service(HttpServer.HttpServer));
	if (server.address._tag !== "TcpAddress") {
		throw new Error("Expected a TCP daemon");
	}
	return { port: server.address.port, stop: () => runtime.dispose() };
}
