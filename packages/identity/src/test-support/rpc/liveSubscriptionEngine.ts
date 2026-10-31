import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Clock, Context, Effect, Fiber, Layer, Option, Queue, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { AppChanges, appHost } from "@shivaedev/server/appHost.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { Authenticated } from "#middleware.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { createProvider } from "./harness.ts";

export const documents = collection("documents", Schema.String);

export const liveSubscriptionEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const provider = yield* createProvider(database.url);
	const mintingAuth = betterAuth({ ...provider.auth.options, plugins: [testUtils()] });
	const session = yield* Effect.promise(() => signedInUser(mintingAuth, { email: "alice@example.test", name: "alice" }));
	const cookie = session.headers.get("cookie");
	if (cookie === null) {
		return yield* Effect.die("The signed-in precondition needs a session cookie");
	}
	const state = { readable: true, unavailable: false };
	const sessions = betterAuthSessions(provider.getSession);
	const Api = contract("documents", {
		queries: [
			query("get", {
				readPolicy: (_payload, viewer) => Effect.sync(() => Option.isSome(viewer) && state.readable),
				reads: () => [documents.item("alice")],
				success: Schema.String,
			}),
		],
	}).middleware(Authenticated);
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const clock = yield* Clock.Clock;
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Api,
			handlers: Api.application.toLayer({ "documents.get": () => Effect.succeed("alice's document") }),
			services: Layer.merge(Layer.succeed(AppChanges, live), Layer.succeed(Reactivity.Reactivity, reactivity)),
			sessions: {
				origin: () => true,
				provider: {
					get: (headers) =>
						Effect.suspend(() =>
							state.unavailable ? Effect.fail(new AuthUnavailable({ message: "Session store unavailable" })) : sessions.get(headers),
						),
				},
				streamRevalidationInterval: "5 seconds",
			},
		}).pipe(Layer.provideMerge(Layer.succeed(Clock.Clock, clock))),
	);
	const server = Context.getUnsafe(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The subscription story needs a TCP listener");
	}
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([layerWebSocket(`ws://127.0.0.1:${server.address.port}/rpc`, { headers: { cookie } }), RpcSerialization.layerNdjson]),
	);
	const transport = yield* Layer.build(protocol);
	const client = yield* RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(transport));
	const hints = yield* Queue.unbounded<string>();
	const following = yield* client("documents.$changes", { queries: [{ payload: undefined, query: "get" }] }).pipe(
		Stream.runForEach((hint) => Queue.offer(hints, hint._tag === "Resync" ? "resync" : "changed")),
		answered,
		Effect.forkScoped,
	);
	return { client, cookie, ending: Fiber.join(following), hints, provider, reactivity, session, state };
});
