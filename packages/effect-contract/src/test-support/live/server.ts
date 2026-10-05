import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { Deferred, Effect, Layer, ManagedRuntime, PubSub, Ref, Stream } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import type { LiveHint } from "#live.ts";
import { Document, documents, Get, LiveDocuments, Unavailable } from "./contract.ts";

export async function liveServer(asset = "", initial: LiveHint = { _tag: "Resync" }) {
	const stored = await Effect.runPromise(
		Ref.make(
			new Map([
				["one", "First"],
				["two", "Second"],
			]),
		),
	);
	const reads = await Effect.runPromise(Ref.make<readonly string[]>([]));
	const unavailable = await Effect.runPromise(Ref.make(false));
	const streamUnavailable = await Effect.runPromise(Ref.make(false));
	const disconnect = await Effect.runPromise(Ref.make(Effect.runSync(Deferred.make<void>())));
	const gate = await Effect.runPromise(Ref.make<Effect.Effect<void>>(Effect.void));
	const events = await Effect.runPromise(PubSub.bounded<LiveHint>(256));
	const connections = await Effect.runPromise(Ref.make(0));
	const active = await Effect.runPromise(Ref.make(0));
	function record(id: string) {
		return Ref.update(reads, (all) => [...all, id]);
	}
	const handlers = LiveDocuments.toLayer({
		"documents.get": ({ id }) =>
			Effect.gen(function* () {
				yield* record(id);
				const body = (yield* Ref.get(stored)).get(id);
				yield* yield* Ref.get(gate);
				if (yield* Ref.get(unavailable)) {
					return yield* Get.reject.Unavailable({});
				}
				return body === undefined ? yield* Get.reject.Missing({ id }) : new Document({ body, id });
			}),
		"documents.list": () =>
			Effect.andThen(
				record("list"),
				Effect.map(Ref.get(stored), (all) => [...all].map(([id, body]) => new Document({ body, id }))),
			),
		subscribe: () =>
			Stream.unwrap(
				Effect.gen(function* () {
					yield* Ref.update(connections, (count) => count + 1);
					if (yield* Ref.get(streamUnavailable)) {
						return Stream.fail(new Unavailable());
					}
					yield* Effect.acquireRelease(
						Ref.update(active, (count) => count + 1),
						() => Ref.update(active, (count) => count - 1),
					);
					const subscription = yield* PubSub.subscribe(events);
					const ended = yield* Ref.get(disconnect);
					return Stream.concat(Stream.succeed(initial), Stream.fromEffectRepeat(PubSub.take(subscription))).pipe(
						Stream.interruptWhen(Deferred.await(ended)),
					);
				}),
			),
	});
	const routes = Layer.merge(
		RpcServer.layerHttp({ group: LiveDocuments, path: "/rpc", protocol: "http" }).pipe(Layer.provide([handlers, RpcSerialization.layerNdjson])),
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
	if (server.address._tag !== "TcpAddress") {
		throw new Error("Expected TCP server");
	}
	const { hostname, port } = server.address;
	return {
		active,
		close: async () => {
			await Effect.runPromise(PubSub.shutdown(events));
			await runtime.dispose();
		},
		connections,
		disconnect: () =>
			Effect.runPromise(
				Effect.gen(function* () {
					const next = yield* Deferred.make<void>();
					const previous = yield* Ref.getAndSet(disconnect, next);
					yield* Deferred.succeed(previous, undefined);
				}),
			),
		edit: async (id: string, body: string) => {
			await Effect.runPromise(Ref.update(stored, (all) => new Map([...all, [id, body]])));
			await Effect.runPromise(PubSub.publish(events, { _tag: "Changed", keys: [documents.item(id)] }));
		},
		emit: (hint: LiveHint) => Effect.runPromise(PubSub.publish(events, hint)),
		gate,
		reads,
		streamUnavailable,
		unavailable,
		url: `http://${hostname}:${port}`,
	};
}
