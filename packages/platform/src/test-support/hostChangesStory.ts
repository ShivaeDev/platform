import { Deferred, Effect, Layer, ManagedRuntime, Stream } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#server/appHost.ts";

class Observed extends RpcMiddleware.Service<Observed>()("test/ObservedChanges") {}
const Api = contract("idle", {}).middleware(Observed);

export const hostChangesStory = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const started = yield* Deferred.make<void>();
			const runtime = yield* Effect.acquireRelease(
				Effect.sync(() =>
					ManagedRuntime.make(
						appHost({
							config: { port: 0 },
							group: Api,
							handlers: Layer.succeed(Observed, (effect) => Effect.andThen(Deferred.succeed(started, undefined), effect)),
							policy: "loopback",
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
		}),
	name: "host change handlers",
	stages: [],
	verbs: (engine, story) => ({
		awaitSubscribed: () => Deferred.await(engine.started),
		subscribe: () => {
			story.tell("subscribe through the host without a changes service");
			return engine.client("idle.$changes", { keys: [] }).pipe(Stream.runDrain, Effect.forkScoped);
		},
	}),
});
