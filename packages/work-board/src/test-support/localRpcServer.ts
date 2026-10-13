import { createServer, request } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Context, Effect, Exit, Layer, Schema, Scope } from "effect";
import { HttpRouter, HttpServer, HttpServerRequest } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";

const LocalRpcs = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));

export const localRpcServer = Effect.fn("Test.localRpcServer")(function* (
	serialization: Layer.Layer<RpcSerialization.RpcSerialization> = RpcSerialization.layerNdjson,
) {
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
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { disablePreemptiveShutdown: true, host: "127.0.0.1", port: 0 })),
		),
		scope,
	);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		throw new Error("Expected a TCP RPC server");
	}
	const hostname = NetAddress.formatIp(server.address.address);
	const { port } = server.address;
	return {
		calls: () => calls,
		close: () => Scope.close(scope, Exit.void),
		host: `${hostname}:${port}`,
		post: (headers: Readonly<Record<string, string>>, json = false) =>
			new Promise<{
				readonly body: string;
				readonly status: number;
			}>((resolve, reject) => {
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
});
