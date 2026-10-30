import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer, PubSub, Schema, Stream } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

export const ReadPage = contract("page", {
	commands: [command("write", { invalidates: () => [], payload: { id: Schema.Number, title: Schema.String } })],
	queries: [
		query("get", {
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [{ _tag: "Item", collection: "pages", id }],
			success: Schema.String,
		}),
	],
});

export const readPageHost = Effect.gen(function* () {
	const titles = new Map([[1, "First page"]]);
	const changes = yield* PubSub.unbounded<LiveHint>();
	const handlers = ReadPage.toLayer({
		"page.$changes": ({ queries }) =>
			Stream.concat(
				Stream.succeed({ _tag: "Resync" } as const),
				Stream.fromPubSub(changes).pipe(
					Stream.filter(
						(hint) => hint._tag === "Changed" && hint.keys.some((key) => key._tag === "Item" && queries.some(({ payload }) => payload.id === key.id)),
					),
				),
			),
		"page.get": ({ id }) => Effect.sync(() => titles.get(id) ?? "Missing page"),
		"page.write": ({ id, title }) =>
			Effect.sync(() => titles.set(id, title)).pipe(
				Effect.andThen(PubSub.publish(changes, { _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id }] })),
				Effect.asVoid,
			),
	});
	const routes = RpcServer.layerHttp({ group: ReadPage, path: "/rpc", protocol: "websocket" }).pipe(
		Layer.provide([handlers, RpcSerialization.layerNdjson]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(routes, { disableLogger: true }).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP page host");
	}
	return { url: `http://127.0.0.1:${server.address.port}/rpc` };
});
