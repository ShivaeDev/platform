import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Deferred, Effect, type Fiber, Layer, ManagedRuntime, Option, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";
import { hintWords } from "#test/rpc/followHints.ts";

class Greeting extends Context.Service<Greeting, string>()("@shivaedev/server/test/ChangesGreeting") {}
class Observed extends RpcMiddleware.Service<Observed, { provides: Greeting }>()("@shivaedev/server/test/ObservedChanges") {}
const Api = contract("idle", {
	queries: [
		query("greet", {
			payload: { name: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.String,
		}),
	],
}).middleware(Observed);

const customHandlers = changesHandlerLayer(
	Api,
	() => () =>
		Stream.fromEffect(Greeting).pipe(
			Stream.map((greeting) => ({
				_tag: "Changed",
				keys: [{ _tag: "Item", collection: "greetings", id: greeting }],
			})),
		),
);

const openHost = Effect.fn("Test.openHost")(function* (live: boolean, custom = false) {
	const clock = yield* Clock.Clock;
	const started = yield* Deferred.make<void>();
	const runtime = yield* Effect.acquireRelease(
		Effect.sync(() =>
			ManagedRuntime.make(
				appHost({
					config: { port: 0 },
					group: Api,
					handlers: Layer.mergeAll(
						Api.application.toLayer({ "idle.greet": ({ name }) => Effect.map(Greeting, (greeting) => `${greeting}, ${name}`) }),
						custom ? customHandlers : Layer.empty,
						Layer.succeed(Observed, (effect) =>
							Effect.andThen(Deferred.succeed(started, undefined), Effect.provideService(effect, Greeting, "Hello")),
						),
					),
					policy: "loopback",
					services: live ? LiveServer.layer.pipe(Layer.provide(Reactivity.layer)) : Layer.empty,
				}).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, clock))),
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
	clock: "test",
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
	clock: "test",
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

export const customHandlerStory = storyKit({
	clock: "test",
	create: () => openHost(false, true),
	name: "custom hosted changes handler",
	stages: [],
	verbs: (state, story) => ({
		firstHint: () => {
			story.tell("subscribe through the custom handler that reads the middleware's greeting");
			return state.client("idle.$changes", { queries: [] }).pipe(
				Stream.runHead,
				Effect.map((update) => (Option.isSome(update) ? hintWords(update.value) : "no hint")),
			);
		},
	}),
});
