import { Context, Deferred, Effect, Layer, ManagedRuntime, Schema, Stream } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppChanges, appHost } from "#server/appHost.ts";

class Greeting extends Context.Service<Greeting, string>()("test/ChangesGreeting") {}
class Observed extends RpcMiddleware.Service<Observed, { provides: Greeting }>()("test/ObservedChanges") {}
const Api = contract("idle", { queries: [query("greet", { payload: { name: Schema.String }, reads: () => [], success: Schema.String })] }).middleware(
	Observed,
);

const openHost = Effect.fn("Test.openHost")(function* (live: boolean) {
	const started = yield* Deferred.make<void>();
	const runtime = yield* Effect.acquireRelease(
		Effect.sync(() =>
			ManagedRuntime.make(
				appHost({
					config: { port: 0 },
					group: Api,
					handlers: Layer.merge(
						Api.application.toLayer({ "idle.greet": ({ name }) => Effect.map(Greeting, (greeting) => `${greeting}, ${name}`) }),
						Layer.succeed(Observed, (effect) =>
							Effect.andThen(Deferred.succeed(started, undefined), Effect.provideService(effect, Greeting, "Hello")),
						),
					),
					policy: "loopback",
					services: live ? Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provide(Reactivity.layer)) : Layer.empty,
				}),
			),
		),
		(current) => Effect.promise(() => current.dispose()),
	);
	const server = yield* Effect.promise(() => runtime.runPromise(HttpServer.HttpServer));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP host");
	}
	const client = yield* RpcClient.make(Api, { flatten: true }).pipe(
		Effect.provide(
			RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${server.address.port}/rpc` }).pipe(
				Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			),
		),
	);
	return { client, started };
});

export const hostChangesStory = storyKit({
	clock: "live",
	create: () => openHost(false),
	name: "host change handlers",
	stages: [],
	verbs: (engine, story) => ({
		awaitSubscribed: () => Deferred.await(engine.started),
		subscribe: () => {
			story.tell("subscribe through the host without a changes service");
			return engine.client("idle.$changes", { queries: [] }).pipe(Stream.runDrain, Effect.forkScoped);
		},
	}),
});

export const applicationHandlersStory = storyKit({
	clock: "live",
	create: () => openHost(true),
	name: "hosted application handlers",
	stages: [],
	verbs: (engine) => ({
		greet: (name: string) => engine.client("idle.greet", { name }),
		subscribe: () => engine.client("idle.$changes", { queries: [] }).pipe(Stream.take(1), Stream.runCollect),
	}),
});
