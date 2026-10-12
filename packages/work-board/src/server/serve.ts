import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { type BoardOptions, boardLayer } from "./board.ts";

export const HOST = "127.0.0.1";

export interface ServeOptions extends BoardOptions {
	readonly port: number;
}

export function listenOn(port: number) {
	return NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: HOST, port });
}

export function serveBoard(options: ServeOptions) {
	return HttpRouter.serve(boardLayer(options), { disableLogger: true }).pipe(Layer.provideMerge(listenOn(options.port)));
}
