import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, Schema, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

const notes = { _tag: "List", collection: "loaderNotes" } as const;
const Get = query("get", { reads: () => [notes], success: Schema.Struct({ title: Schema.String }) });
const Rename = command("rename", { invalidates: () => [notes], payload: { title: Schema.String } });
const Notes = contract("loaderNotes", { commands: [Rename], queries: [Get] });

export const loaderHost = Effect.fnUntraced(function* () {
	const calls: string[] = [];
	let response = Promise.withResolvers<{ readonly title: string }>();
	const handlers = Notes.toLayer({
		"loaderNotes.$changes": () => Stream.never,
		"loaderNotes.get": () =>
			Effect.suspend(() => {
				calls.push("get");
				return Effect.promise(() => response.promise);
			}),
		"loaderNotes.rename": ({ title }) =>
			Effect.sync(() => {
				response = Promise.withResolvers();
				response.resolve({ title });
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
	const { api, Client } = makeRpcClient(Notes, { serialization: RpcSerialization.layerJson, url });
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
		rename: (title: string) => Client.runtime.atom(api.rename.run({ title })),
		respond: (title: string) => response.resolve({ title }),
		source: atom.initialValueTarget,
	};
});
