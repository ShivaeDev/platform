import { createServer, request } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest } from "effect/unstable/http";
import { Rpc, RpcGroup, RpcSerialization, RpcServer } from "effect/unstable/rpc";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";

const LocalRpcs = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));

export async function localRpcServer(serialization: Layer.Layer<RpcSerialization.RpcSerialization> = RpcSerialization.layerNdjson) {
	let calls = 0;
	const handlers = LocalRpcs.toLayer({
		ping: () =>
			Effect.sync(() => {
				calls += 1;
				return "pong";
			}),
	});
	const routes = HttpRouter.use((router) =>
		Effect.gen(function* () {
			const wire = yield* RpcSerialization.RpcSerialization;
			const handler = yield* RpcServer.toHttpEffect(LocalRpcs);
			yield* router.add("POST", "/rpc", (incoming) =>
				localRpcGuard(handler).pipe(
					Effect.provideService(HttpServerRequest.HttpServerRequest, incoming),
					Effect.provideService(RpcSerialization.RpcSerialization, wire),
				),
			);
		}),
	).pipe(Layer.provide([handlers, serialization]));
	const runtime = ManagedRuntime.make(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: "127.0.0.1", port: 0 })),
		),
	);
	const server = await runtime.runPromise(HttpServer.HttpServer);
	if (server.address._tag !== "TcpAddress") {
		await runtime.dispose();
		throw new Error("Expected a TCP RPC server");
	}
	const { hostname, port } = server.address;
	return {
		calls: () => calls,
		close: () => runtime.dispose(),
		host: `${hostname}:${port}`,
		post: (headers: Readonly<Record<string, string>>, json = false) =>
			new Promise<{ readonly body: string; readonly status: number }>((resolve, reject) => {
				const outgoing = request({ headers, host: hostname, method: "POST", path: "/rpc", port }, (response) => {
					let body = "";
					response.setEncoding("utf8");
					response.on("data", (chunk: string) => {
						body += chunk;
					});
					response.on("end", () => resolve({ body, status: response.statusCode ?? 0 }));
				});
				outgoing.on("error", reject);
				const message = { _tag: "Request", headers: [], id: "1", payload: null, tag: "ping" };
				outgoing.end(json ? JSON.stringify([message]) : `${JSON.stringify(message)}\n`);
			}),
	};
}
