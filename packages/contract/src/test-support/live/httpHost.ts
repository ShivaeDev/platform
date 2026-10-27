import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { type Rpc, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import type { Guard } from "#test/notes.ts";
import { LiveNotes } from "./notesContract.ts";

export async function httpHost(handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<typeof LiveNotes>>>, guard: Layer.Layer<Guard>, asset: string) {
	const routes = Layer.merge(
		RpcServer.layerHttp({ group: LiveNotes, path: "/rpc", protocol: "http" }).pipe(Layer.provide([handlers, guard, RpcSerialization.layerNdjson])),
		HttpRouter.use((router) =>
			Effect.all([
				router.add(
					"GET",
					"/",
					HttpServerResponse.html(
						'<meta name="viewport" content="width=device-width,initial-scale=1"><style>html{color-scheme:light dark}body{font:16px system-ui;margin:24px;overflow-wrap:anywhere;}output{display:block;margin:16px 0}button{padding:12px;margin-right:8px}</style><main><h1>Live documents</h1><output id="one"></output><output id="two"></output><output id="list"></output><output id="status"></output><output id="resume-events"></output><button id="pause">Pause</button><button id="resume">Resume</button></main><script type="module" src="/client.js"></script>',
					),
				),
				router.add("GET", "/client.js", HttpServerResponse.text(asset, { contentType: "text/javascript" })),
			]),
		),
	);
	const runtime = ManagedRuntime.make(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = await runtime.runPromise(Effect.service(HttpServer.HttpServer));
	if (!NetAddress.isInetAddress(server.address)) {
		throw new Error("Expected TCP server");
	}
	const hostname = NetAddress.formatIp(server.address.address);
	const { port } = server.address;
	return { close: () => runtime.dispose(), url: `http://${hostname}:${port}` };
}
