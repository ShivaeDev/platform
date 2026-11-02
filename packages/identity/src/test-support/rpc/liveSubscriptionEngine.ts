import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Effect, Fiber, Layer, Option, Queue, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { SessionUser } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { hasPermission } from "#permission.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { liveSubscriptionProvider, ReadDocuments } from "./liveSubscriptionProvider.ts";

export const documents = collection("documents", Schema.String);

export const liveSubscriptionEngine = Effect.fnUntraced(function* (delivery: "hints" | "pushed" = "hints") {
	const provider = yield* liveSubscriptionProvider;
	const session = yield* signedInUser(provider.auth, { email: "alice@example.test", name: "alice" });
	const cookie = session.headers.get("cookie");
	if (cookie === null) {
		return yield* Effect.die("The signed-in precondition needs a session cookie");
	}
	const state = { readable: true, unavailable: false };
	const sessions = provider.sessions.provider;
	const Api = contract("documents", {
		queries: [
			query("get", {
				live: delivery === "pushed" ? "rerun-and-compare" : undefined,
				readPolicy: (_payload, viewer) =>
					Effect.map(SessionUser, (user) => Option.isSome(viewer) && state.readable && hasPermission(user, ReadDocuments)),
				reads: () => [documents.item("alice")],
				success: Schema.String,
			}),
		],
	}).middleware(AuthenticatedUser);
	const reactivity = yield* Reactivity.make;
	const live = yield* LiveServer.pipe(Effect.provide(LiveServer.layer.pipe(Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity)))));
	const clock = yield* Clock.Clock;
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Api,
			handlers: Api.application
				.toLayer({ "documents.get": () => Effect.map(SessionUser, (user) => `alice's document for ${user.role}`) })
				.pipe(Layer.provideMerge(authenticatedUserLayer())),
			services: Layer.merge(Layer.succeed(LiveServer, live), Layer.succeed(Reactivity.Reactivity, reactivity)),
			sessions: Layer.succeed(SessionPolicy, {
				...provider.sessions,
				origin: () => true,
				provider: {
					get: (headers) =>
						Effect.suspend(() =>
							state.unavailable ? Effect.fail(new AuthUnavailable({ message: "Session store unavailable" })) : sessions.get(headers),
						),
				},
				streamRevalidationInterval: "5 seconds",
			}),
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
		Stream.runForEach((hint) => Queue.offer(hints, updateWords(hint))),
		answered,
		Effect.forkScoped,
	);
	return { client, cookie, ending: Fiber.join(following), hints, provider, reactivity, session, state };
});

function updateWords(update: QueryUpdate) {
	switch (update._tag) {
		case "Result":
			return String(update.value);
		case "QueryReadDenied":
			return "read denied";
		case "Resync":
			return "resync";
		case "Changed":
			return "changed";
	}
}
