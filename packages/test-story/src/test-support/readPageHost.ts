import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Deferred, Effect, Layer, PubSub, Schema, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";

export const ReadPage = contract("page", {
	commands: [command("write", { invalidates: () => [], payload: { id: Schema.Number, title: Schema.String } })],
	queries: [
		query("get", {
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [{ _tag: "Item", collection: "pages", id }],
			success: Schema.String,
		}),
		query("second", {
			live: "rerun-and-compare",
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.String,
		}),
	],
});

export const readPageHost = Effect.gen(function* () {
	const titles = new Map([[1, "First page"]]);
	const held = yield* Deferred.make<void>();
	const opened = yield* PubSub.unbounded<number>();
	const changes = yield* PubSub.unbounded<LiveHint>();
	const handlers = ReadPage.toLayer({
		"page.$changes": ({ queries }) => {
			const id = queries[0]?.payload.id ?? 1;
			const initial = id === 2 ? ({ _tag: "Result", query: "second", queryIndex: 0, value: "Second page" } as const) : ({ _tag: "Resync" } as const);
			const related = Stream.fromPubSub(changes).pipe(
				Stream.filter(
					(hint) => hint._tag === "Changed" && hint.keys.some((key) => key._tag === "Item" && queries.some(({ payload }) => payload.id === key.id)),
				),
			);
			return Stream.unwrap(
				Effect.gen(function* () {
					yield* PubSub.publish(opened, id);
					if (id === 3) {
						return Stream.fail(new QueryReadDenied({ message: "Private page" }));
					}
					if (id === 2) {
						yield* Deferred.await(held);
					}
					return Stream.concat(Stream.succeed(initial), related);
				}),
			);
		},
		"page.get": ({ id }) => Effect.sync(() => titles.get(id) ?? "Missing page"),
		"page.second": () => Effect.succeed("Waiting for live data"),
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
		HttpRouter.serve(
			Layer.mergeAll(
				routes,
				HttpRouter.add("POST", "/sign-in", HttpServerResponse.text("alice")),
				HttpRouter.add("POST", "/sign-out", HttpServerResponse.text("")),
			),
			{ disableLogger: true },
		).pipe(Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP page host");
	}
	return { held, opened, url: `http://127.0.0.1:${server.address.port}/rpc` };
});
