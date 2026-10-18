import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";

const Get = query("get", { reads: () => [], success: Schema.Struct({ title: Schema.String }) });
const Notes = contract("loaderNotes", { queries: [Get] });

export const loaderHost = Effect.fnUntraced(function* () {
	const calls: string[] = [];
	let response = Promise.withResolvers<{ readonly title: string }>();
	const handlers = Notes.toLayer({
		"loaderNotes.get": () =>
			Effect.suspend(() => {
				calls.push("get");
				return Effect.promise(() => response.promise);
			}),
	});
	const routes = RpcServer.layerHttp({ group: Notes, path: "/rpc", protocol: "http" }).pipe(Layer.provide([handlers, RpcSerialization.layerJson]));
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP host");
	}
	const url = `http://${NetAddress.formatIp(server.address.address)}:${server.address.port}/rpc`;
	class Client extends AtomRpc.Service<Client>()("test/LoaderHost", {
		group: Notes,
		protocol: RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
	}) {}
	const api = bind(Notes, Client);
	const atom = api.get.query();
	if (!atom.initialValueTarget) {
		return yield* Effect.die("Expected a native reactive query source");
	}
	return {
		atom,
		calls,
		next: () => {
			response = Promise.withResolvers();
		},
		respond: (title: string) => response.resolve({ title }),
		source: atom.initialValueTarget,
	};
});
