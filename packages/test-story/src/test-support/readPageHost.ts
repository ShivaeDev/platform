import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Deferred, Effect, Layer, PubSub, Queue, Schema, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";

export const ReadPage = contract("page", {
	commands: [command("write", { invalidates: () => [], payload: { id: Schema.Number, title: Schema.String }, success: Schema.String })],
	queries: [
		query("get", {
			payload: { id: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [{ _tag: "Item", collection: "pages", id }],
			rejections: { Missing: { id: Schema.Number } },
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
	const held = yield* Deferred.make<"hint" | "empty" | "defect">();
	let readGate: Deferred.Deferred<void> | undefined;
	let writeGate: Deferred.Deferred<void> | undefined;
	const writing = yield* Queue.unbounded<void>();
	const reading = yield* Queue.unbounded<void>();
	function holdRead() {
		readGate = Deferred.makeUnsafe<void>();
	}
	function releaseRead() {
		if (readGate === undefined) {
			throw new Error("No page read is held");
		}
		Effect.runSync(Deferred.succeed(readGate, undefined));
		readGate = undefined;
	}
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
						const reply = yield* Deferred.await(held);
						if (reply === "empty") {
							return Stream.empty;
						}
						if (reply === "defect") {
							return Stream.die(new Error("Live page stream failed"));
						}
					}
					return Stream.concat(Stream.succeed(initial), related);
				}),
			);
		},
		"page.get": ({ id }) =>
			Effect.gen(function* () {
				if (readGate !== undefined) {
					yield* Queue.offer(reading, undefined);
					yield* Deferred.await(readGate);
				}
				const title = titles.get(id);
				return title === undefined ? yield* ReadPage.declaration.queries[0].reject.Missing({ id }) : title;
			}),
		"page.second": () => Effect.succeed("Waiting for live data"),
		"page.write": ({ id, title }) =>
			Effect.gen(function* () {
				if (writeGate !== undefined) {
					yield* Queue.offer(writing, undefined);
					yield* Deferred.await(writeGate);
				}
				titles.set(id, title);
				yield* PubSub.publish(changes, { _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id }] });
				return title;
			}),
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
	return {
		held,
		holdRead,
		holdWrite: () => {
			writeGate = Deferred.makeUnsafe<void>();
		},
		opened,
		reading,
		releaseRead,
		releaseWrite: () => {
			if (writeGate === undefined) {
				throw new Error("No page write is held");
			}
			Effect.runSync(Deferred.succeed(writeGate, undefined));
			writeGate = undefined;
		},
		url: `http://127.0.0.1:${server.address.port}/rpc`,
		writing,
	};
});
