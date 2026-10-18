import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, FileSystem, Layer, Logger, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { serveBoard } from "#server/serve.ts";

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
	const board = serveBoard({ port: 0, root }).pipe(Layer.provide(Layer.merge(NodeServices.layer, fileSystem)));
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(board.pipe(Layer.provide(Logger.layer([logger]))), scope);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		throw new Error("the board did not listen on TCP");
	}
	return {
		hostname: NetAddress.formatIp(server.address.address),
		logged,
		port: server.address.port,
		stop: () => Scope.close(scope, Exit.void),
		url: `http://${NetAddress.formatIp(server.address.address)}:${server.address.port}`,
	};
});
