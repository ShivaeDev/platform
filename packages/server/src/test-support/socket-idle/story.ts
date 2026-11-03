import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Clock, Deferred, Effect, Fiber, Layer, Option, Queue, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { TestClock } from "effect/testing";
import { contract } from "@shivaedev/contract/contract.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";

const Api = contract("idleSession", {
	queries: [
		query("get", {
			payload: { slot: Schema.Number },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.String,
		}),
	],
}).middleware(Authenticated);

export const socketIdleStory = storyKit({
	clock: "test",
	*create() {
		const checked = yield* Queue.unbounded<void>();
		const state: { baseline: number; lookups: number; status: "signed in" | "signed out" | "unavailable" } = {
			baseline: 0,
			lookups: 0,
			status: "signed in",
		};
		const sessions = Layer.succeed(SessionPolicy, {
			origin: () => true,
			provider: {
				get: () =>
					Effect.gen(function* () {
						state.lookups += 1;
						if (state.baseline > 0) {
							yield* Queue.offer(checked, undefined);
						}
						if (state.status === "unavailable") {
							return yield* new AuthUnavailable({ message: "Session store unavailable" });
						}
						return state.status === "signed out" ? Option.none() : Option.some({ user: { id: "alice" } });
					}),
			},
			streamRevalidationInterval: "5 seconds",
		});
		const services = yield* Layer.build(
			appHost({
				config: { port: 0 },
				group: Api,
				handlers: Api.application.toLayer({ "idleSession.get": () => Effect.succeed("Ready") }),
				services: LiveServer.layer.pipe(Layer.provide(Reactivity.layer)),
				sessions,
			}),
		);
		const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
		if (!NetAddress.isInetAddress(address)) {
			return yield* Effect.die("Expected a TCP host");
		}
		const protocol = yield* Layer.build(
			RpcClient.layerProtocolSocket().pipe(
				Layer.provide([layerWebSocket(`ws://127.0.0.1:${address.port}/rpc`), RpcSerialization.layerNdjson]),
				Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())),
			),
		);
		const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(protocol));
		const streams = yield* Effect.forEach([0, 1, 2, 3], (slot) =>
			Effect.gen(function* () {
				const ready = yield* Deferred.make<void>();
				const ended = yield* client("idleSession.$changes", { queries: [{ payload: { slot }, query: "get" }] }).pipe(
					Stream.runForEach(() => Deferred.succeed(ready, undefined)),
					answered,
					Effect.forkScoped,
				);
				yield* Deferred.await(ready);
				return ended;
			}),
		);
		state.baseline = state.lookups;
		return { checked, state, streams };
	},
	name: "hosted idle socket sessions",
	stages: [],
	verbs: (engine, story) => ({
		intervalPasses: () => {
			story.tell("five seconds pass without a write or a hint");
			return TestClock.adjust("5 seconds").pipe(Effect.andThen(Queue.take(engine.checked)));
		},
		lookupCount: () => ({ sessionLookups: engine.state.lookups - engine.state.baseline }),
		providerOutage: () =>
			Effect.sync(() => {
				engine.state.status = "unavailable";
			}),
		signOut: () =>
			Effect.sync(() => {
				engine.state.status = "signed out";
			}),
		streamEnds: () => Effect.forEach(engine.streams, Fiber.join),
	}),
});
