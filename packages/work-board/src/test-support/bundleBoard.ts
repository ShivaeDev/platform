import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, FileSystem, Layer, Logger, Scope } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { boardLayer } from "#board.ts";
import { listenOn } from "#serve.ts";

export const bundleBoard = Effect.fn("Test.bundleBoard")(function* (root: string, assets: readonly string[]) {
	const logged: Array<{ readonly level: string; readonly message: unknown }> = [];
	const logger = Logger.make(({ logLevel, message }) => logged.push({ level: logLevel, message }));
	function local(path: string) {
		return assets.some((asset) => path.endsWith(`/assets/${asset}`)) ? join(root, path.split("/").at(-1) ?? "") : path;
	}
	const fileSystem = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			exists: (path) => fs.exists(local(path)),
			readFile: (path) => fs.readFile(local(path)),
		})),
	).pipe(Layer.provide(NodeServices.layer));
	const board = boardLayer({ root }).pipe(Layer.provide(fileSystem));
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(
		HttpRouter.serve(board, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(0)), Layer.provide(Logger.layer([logger]))),
		scope,
	);
	const server = Context.get(context, HttpServer.HttpServer);
	if (server.address._tag !== "TcpAddress") {
		throw new Error("the board did not listen on TCP");
	}
	return { logged, stop: () => Scope.close(scope, Exit.void), url: `http://${server.address.hostname}:${server.address.port}` };
});
