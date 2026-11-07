import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Effect, Fiber, Layer, Option, Queue, Schema, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { SessionUser } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { hasPermission } from "#permission.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { liveSubscriptionProvider, ReadDocuments } from "#test/rpc/liveSubscriptionProvider.ts";

export const documents = collection("documents", Schema.String);

export const liveSubscriptionEngine = Effect.fnUntraced(function* () {
	const provider = yield* liveSubscriptionProvider;
	const session = yield* signedInUser(provider.auth, { email: "alice@example.test", name: "alice" });
	const cookie = session.headers.get("cookie");
	if (cookie === null) {
		return yield* Effect.die("The signed-in precondition needs a session cookie");
	}
	const state = { readable: true, unavailable: false };
	const checked = yield* Queue.unbounded<void>();
	const sessions = provider.sessions.provider;
	const Api = contract("documents", {
		queries: [
			query("get", {
				readPolicy: (_payload, viewer) =>
					Effect.map(SessionUser, (user) => Option.isSome(viewer) && state.readable && hasPermission(user, ReadDocuments)),
				reads: () => [documents.item("alice")],
				success: Schema.String,
			}),
		],
	}).middleware(AuthenticatedUser);
	const reactivity = yield* Reactivity.make;
	const live = yield* LiveServer.pipe(Effect.provide(liveServerLayer.pipe(Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity)))));
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
						).pipe(Effect.ensuring(Queue.offer(checked, undefined))),
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
	return { checked, client, cookie, ending: Fiber.join(following), hints, provider, reactivity, session, state };
});

function updateWords(update: QueryUpdate) {
	switch (update._tag) {
		case "Result":
			return String(update.value);
		case "Unchanged":
			return "unchanged";
		case "QueryReadDenied":
			return "read denied";
	}
}
