import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { type BoardOptions, boardLayer } from "./board.ts";

export const HOST = "127.0.0.1";

export interface ServeOptions extends BoardOptions {
	readonly port: number;
}

export const listenOn = (port: number) => NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: HOST, port });

export const serveBoard = (options: ServeOptions) =>
	HttpRouter.serve(boardLayer(options), { disableLogger: true }).pipe(Layer.provideMerge(listenOn(options.port)));
