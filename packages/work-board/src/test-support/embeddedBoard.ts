import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { boardLayer } from "#board.ts";
import { listenOn } from "#serve.ts";

export const embeddedBoard = Effect.fn("Test.embeddedBoard")(function* (root: string) {
	const health = HttpRouter.use((router) => router.add("GET", "/health", Effect.succeed(HttpServerResponse.text("healthy"))));
	const routes = Layer.merge(boardLayer({ root }), health).pipe(Layer.provide(NodeServices.layer));
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(0))), scope);
	const server = Context.get(context, HttpServer.HttpServer);
	if (server.address._tag !== "TcpAddress") {
		throw new Error("embedded board did not listen on TCP");
	}
	const { hostname, port } = server.address;
	return { hostname, port, stop: () => Scope.close(scope, Exit.void), url: `http://${hostname}:${port}` };
});
