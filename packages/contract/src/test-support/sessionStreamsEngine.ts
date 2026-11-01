import { Context, Effect, Layer, Schema, Stream, SubscriptionRef } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { appHost } from "@shivaedev/server/appHost.ts";
import { bind, makeClient } from "#bind.ts";
import { contract } from "#contract.ts";
import { socketIdentity } from "#internal/rpcClient.ts";
import { stream } from "#operation.ts";

export type StreamPerson = "alice" | "bob";
class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
const Subscribe = stream("subscribe", {
	payload: { mode: Schema.Literals(["open", "finite", "refused"]), name: Schema.String },
	reads: () => [],
	rejections: { Unavailable },
	success: Schema.String,
});
const Owned = contract("session-streams", { keyScope: "session", streams: [Subscribe] });
const Ordinary = contract("session-streams", { streams: [Subscribe] });

export const sessionStreamsEngine = Effect.gen(function* () {
	const open = yield* SubscriptionRef.make<readonly string[]>([]);
	function subscribe(person: StreamPerson, { mode, name }: typeof Subscribe.payload.Type, headers: Readonly<Record<string, string>>) {
		return Stream.unwrap(
			Effect.gen(function* () {
				if (mode === "refused") {
					return Stream.fail(new Unavailable({}));
				}
				yield* SubscriptionRef.update(open, (all) => [...all, name]);
				const first = Stream.succeed(`${person}:${headers["x-session"]}:${name}`);
				return (mode === "finite" ? first : Stream.concat(first, Stream.never)).pipe(
					Stream.ensuring(SubscriptionRef.update(open, (all) => all.filter((current) => current !== name))),
				);
			}),
		);
	}
	function host(person: StreamPerson) {
		return Effect.gen(function* () {
			const handlers = Owned.application.toLayer({
				"session-streams.subscribe": (payload, { headers }) => subscribe(person, payload, headers),
			});
			const services = yield* Layer.build(appHost({ config: { port: 0 }, group: Owned, handlers, policy: "loopback" }));
			const server = Context.get(services, HttpServer.HttpServer);
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected a TCP listener");
			}
			return `http://127.0.0.1:${server.address.port}/rpc`;
		});
	}
	const urls = { alice: yield* host("alice"), bob: yield* host("bob") };
	function registry(person: StreamPerson) {
		return Effect.acquireRelease(
			Effect.sync(() => {
				const current = AtomRegistry.make();
				current.mount(socketIdentity);
				current.set(socketIdentity, person);
				return current;
			}),
			(current) => Effect.sync(() => current.dispose()),
		);
	}
	const registries = { alice: yield* registry("alice"), bob: yield* registry("bob") };
	const connection = makeClient(Owned, {
		live: false,
		protocol: (identity) =>
			RpcClient.layerProtocolHttp({
				transformClient: HttpClient.mapRequest(HttpClientRequest.setHeader("x-session", identity ?? "anonymous")),
				url: urls[identity === "alice" ? "alice" : "bob"],
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
		registry: registries.alice,
		url: urls.alice,
	});
	const apis = {
		alice: connection.api,
		bob: bind(Owned, connection.Client, { live: false, registry: registries.bob }),
		ordinary: bind(Ordinary, connection.Client, { live: false }),
	};
	function consume<A, E>(effect: Effect.Effect<A, E, Context.Service.Identifier<typeof connection.Client>>, person: StreamPerson) {
		return AtomRegistry.getResult(registries[person], connection.runtime.atom(effect).pipe(Atom.setIdleTTL(0)));
	}
	return { apis, consume, open, registries };
});
