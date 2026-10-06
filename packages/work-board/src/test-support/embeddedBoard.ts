import { NodeServices } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { boardLayer } from "#board.ts";
import { listenOn } from "#serve.ts";
import type { RunningBoard } from "#test/board.ts";

export async function embeddedBoard(root: string): Promise<RunningBoard> {
	const health = HttpRouter.use((router) => router.add("GET", "/health", Effect.succeed(HttpServerResponse.text("healthy"))));
	const routes = Layer.merge(boardLayer({ root }), health).pipe(Layer.provide(NodeServices.layer));
	const runtime = ManagedRuntime.make(HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(0))));
	const server = await runtime.runPromise(Effect.service(HttpServer.HttpServer));
	if (server.address._tag !== "TcpAddress") {
		await runtime.dispose();
		throw new Error("embedded board did not listen on TCP");
	}
	const { hostname, port } = server.address;
	return { hostname, port, stop: () => runtime.dispose(), url: `http://${hostname}:${port}` };
}
