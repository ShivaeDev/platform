import { layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { LiveConnection } from "#automaticLive.ts";
import { makeClient } from "#bind.ts";
import { contract } from "#contract.ts";
import { LiveServer } from "#LiveServer.ts";
import { query } from "#operation.ts";

export const records = collection("header-records", Schema.Number);
class Incoming extends RpcMiddleware.Service<Incoming>()("test/QueryHeaders") {}
const definition = { readPolicy: () => Effect.succeed(true), reads: () => [records.item(1)], success: Schema.String };
const Records = contract("header-records", {
	queries: [query("hints", definition), query("pushed", { ...definition, live: "rerun-and-compare" })],
}).middleware(Incoming);

export const queryHeadersEngine = Effect.gen(function* () {
	const stored = { value: "First" };
	const subscriptions: string[] = [];
	const reads: { readonly reader: string; readonly value: string }[] = [];
	const reactivity = yield* Reactivity.make;
	function read(_payload: unknown, { headers }: { readonly headers: Readonly<Record<string, string>> }) {
		return Effect.sync(() => {
			const reader = headers["x-reader"] ?? "default";
			reads.push({ reader, value: stored.value });
			return `${reader}: ${stored.value}`;
		});
	}
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Records,
			handlers: Layer.merge(
				Records.application.toLayer({ "header-records.hints": read, "header-records.pushed": read }),
				Layer.succeed(Incoming, (effect, { headers, rpc }) => {
					if (rpc._tag === "header-records.$changes") {
						subscriptions.push(headers["x-reader"] ?? "default");
					}
					return effect;
				}),
			),
			policy: "loopback",
			services: LiveServer.layer.pipe(Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity))),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const client = makeClient(Records, { url: `http://127.0.0.1:${server.address.port}/rpc`, webSocketConstructor: layerWebSocketConstructor });
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	registry.set(client.api[LiveConnection].coalesceWindow, 0);
	return { api: client.api, reactivity, reads, registry, stored, subscriptions };
});
