import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Logger, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { boardLayer } from "#board.ts";
import { listenOn } from "#serve.ts";

export async function bundleBoard(root: string) {
	const logged: Array<{ readonly level: string; readonly message: unknown }> = [];
	const logger = Logger.make(({ logLevel, message }) => logged.push({ level: logLevel, message }));
	const bundle = join(root, "native.js");
	const fileSystem = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			exists: (path) => fs.exists(path.endsWith("/assets/native.js") ? bundle : path),
			readFile: (path) => fs.readFile(path.endsWith("/assets/native.js") ? bundle : path),
		})),
	).pipe(Layer.provide(NodeServices.layer));
	const board = boardLayer({ root }).pipe(Layer.provide(fileSystem));
	const runtime = ManagedRuntime.make(
		HttpRouter.serve(board, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(0)), Layer.provide(Logger.layer([logger]))),
	);
	const server = await runtime.runPromise(Effect.service(HttpServer.HttpServer));
	if (server.address._tag !== "TcpAddress") {
		throw new Error("the board did not listen on TCP");
	}
	return { logged, stop: () => runtime.dispose(), url: `http://${server.address.hostname}:${server.address.port}` };
}
