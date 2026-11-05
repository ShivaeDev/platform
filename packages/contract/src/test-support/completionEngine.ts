import { layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Context, Deferred, Effect, Layer, Schema } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { collection } from "@shivaedev/changes/keys.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { LiveConnection } from "#automaticLive.ts";
import { makeClient } from "#bind.ts";
import { contract } from "#contract.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { query } from "#operation.ts";
import { storyRuntime } from "./storyRuntime.ts";

export class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", {}) {}
export const records = collection("completion-records", Schema.Number);

export const completionEngine = Effect.gen(function* () {
	const runtime = yield* storyRuntime;
	const state = { allowed: true, failed: false, held: false, value: "First" };
	const received = yield* Deferred.make<void>();
	const answer = yield* Deferred.make<void>();
	const definition = {
		readPolicy: () => Effect.sync(() => state.allowed),
		reads: () => [records.item(1)],
		rejections: { ReadFailed },
		success: Schema.String,
	};
	const Records = contract("completion-records", {
		queries: [query("hints", definition), query("pushed", { ...definition, live: "rerun-and-compare" })],
	});
	const reactivity = yield* Reactivity.make;
	const read = Effect.gen(function* () {
		yield* Deferred.succeed(received, undefined);
		if (state.held) {
			yield* Deferred.await(answer);
		}
		return yield* state.failed ? Effect.fail(new ReadFailed()) : Effect.succeed(state.value);
	});
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Records,
			handlers: Records.application.toLayer({ "completion-records.hints": () => read, "completion-records.pushed": () => read }),
			policy: "loopback",
			services: liveServerLayer.pipe(Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity))),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const connection = makeClient(Records, {
		runtime,
		url: `http://127.0.0.1:${server.address.port}/rpc`,
		webSocketConstructor: layerWebSocketConstructor,
	});
	registry.set(connection.api[LiveConnection].coalesceWindow, 0);
	const ordinary = makeClient(Records, {
		live: false,
		runtime,
		url: `http://127.0.0.1:${server.address.port}/rpc`,
		webSocketConstructor: layerWebSocketConstructor,
	});
	return { answer, api: connection.api, ordinary: ordinary.api, reactivity, received, registry, state, view: connection.api.hints.query() };
});
