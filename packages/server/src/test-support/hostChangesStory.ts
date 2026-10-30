import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Deferred, Effect, type Fiber, Layer, ManagedRuntime, Option, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { AppChanges, appHost } from "#appHost.ts";
import { answered } from "#test/answers.ts";
import { hintWords } from "#test/rpc/followHints.ts";

class Greeting extends Context.Service<Greeting, string>()("test/ChangesGreeting") {}
class Observed extends RpcMiddleware.Service<Observed, { provides: Greeting }>()("test/ObservedChanges") {}
const Api = contract("idle", {
	queries: [query("greet", { payload: { name: Schema.String }, readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String })],
}).middleware(Observed);

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
	const context = yield* Layer.build(
		RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(`ws://127.0.0.1:${server.address.port}/rpc`), RpcSerialization.layerNdjson])),
	);
	const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(context));
	return { client, started };
});

export const hostChangesStory = storyKit({
	clock: "live",
	*create() {
		const state: { hints: string[]; subscription?: Fiber.Fiber<string> } = { hints: [] };
		return Object.assign(state, yield* openHost(false));
	},
	name: "host change handlers",
	stages: [],
	verbs: (state, story) => ({
		subscribe: () =>
			Effect.gen(function* () {
				story.tell("a client subscribes through a host without a changes service");
				state.subscription = yield* state.client("idle.$changes", { queries: [] }).pipe(
					Stream.runForEach((hint) => Effect.sync(() => state.hints.push(hintWords(hint)))),
					answered,
					Effect.map((answer) => (answer === undefined ? "completed" : answer)),
					Effect.forkScoped,
				);
				yield* Deferred.await(state.started);
			}),
		subscriptionAfterAnotherRequest: () =>
			Effect.gen(function* () {
				yield* state.client("idle.greet", { name: "barrier" });
				const ending = state.subscription?.pollUnsafe();
				return { hints: [...state.hints], state: ending === undefined ? "open" : "ended" };
			}),
	}),
});

export const applicationHandlersStory = storyKit({
	clock: "live",
	create: () => openHost(true),
	name: "hosted application handlers",
	stages: [],
	verbs: (state, story) => ({
		firstHint: () => {
			story.tell("a client subscribes through the host's changes service");
			return state
				.client("idle.$changes", { queries: [] })
				.pipe(Stream.map(hintWords), Stream.runHead, Effect.map(Option.getOrElse(() => "no hint")));
		},
		greet: (name: string) => {
			story.tell(`a client greets ${name}`);
			return answered(state.client("idle.greet", { name }));
		},
	}),
});
