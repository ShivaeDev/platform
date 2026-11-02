import { Context, Effect, Layer } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcMiddleware, RpcSerialization } from "effect/rpc";
import { appHost } from "@shivaedev/server/appHost.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { bind } from "#bind.ts";
import { ClientOffline, Guard, Records } from "./queryFailureContract.ts";

export const queryFailureStory = storyKit({
	clock: "live",
	*create() {
		const access = { offline: false };
		const services = yield* Layer.build(
			appHost({
				config: { port: 0 },
				group: Records,
				handlers: Records.application
					.toLayer({ "query-failures.get": () => Effect.succeed("One"), "query-failures.list": () => Effect.succeed("One, Two") })
					.pipe(Layer.provideMerge(Layer.succeed(Guard, (effect) => effect))),
				policy: "loopback",
			}),
		);
		const server = Context.get(services, HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Expected a TCP listener");
		}
		const protocol = RpcClient.layerProtocolHttp({ url: `http://127.0.0.1:${server.address.port}/rpc` }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
			Layer.provideMerge(
				RpcMiddleware.layerClient(Guard, ({ next, request }) => (access.offline ? Effect.fail(new ClientOffline()) : next(request))),
			),
		);
		class Client extends AtomRpc.Service<Client>()("test/QueryFailureClient", {
			group: Records,
			protocol,
			runtime: Atom.context({ memoMap: Layer.makeMemoMapUnsafe() }),
		}) {}
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(current) => Effect.sync(() => current.dispose()),
		);
		return { access, Client, registry };
	},
	inspect: ({ access }) => ({ offline: access.offline }),
	name: "query atom failures",
	stages: ["client"],
	verbs: (engine, story) => ({
		read: (mode: "ordinary" | "live") => {
			story.tell(`the client opens ${mode === "live" ? "a live" : "an ordinary"} note query`);
			const api = bind(Records, engine.Client, { live: mode === "live" });
			const result = AtomRegistry.getResult(engine.registry, api.get.query());
			function failureOutcome(failure: Effect.Error<typeof result>) {
				switch (failure._tag) {
					case "ClientOffline":
						return "client is offline";
					case "WebSocketRequired":
						return `subscription refused: ${failure.message}`;
					default:
						return `query rejected: ${failure._tag}`;
				}
			}
			return result.pipe(
				Effect.match({
					onFailure: failureOutcome,
					onSuccess: (note) => note,
				}),
			);
		},
	}),
});

export const offline = queryFailureStory.trait("client", "client middleware rejects outgoing requests while offline", ({ access }) => {
	access.offline = true;
});
