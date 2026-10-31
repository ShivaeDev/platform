import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Effect, Layer, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SessionUserWithProviderAccounts } from "@shivaedev/identity/identity.ts";
import { authenticatedUserWithProviderAccountsLayer } from "@shivaedev/identity/server/session.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { LiveServer } from "#LiveServer.ts";
import { Documents, ReadAccess, readAccess } from "./policyServicesContract.ts";

export type Person = "alice" | "bob";

function providerSession(id: string) {
	return {
		user: {
			email: `${id}@example.test`,
			id,
			name: id,
			providerAccounts: Effect.succeed([{ accountId: "team", providerId: id === "alice" ? "github" : "gitlab" }]),
		},
	};
}

export const policyServicesEngine = Effect.gen(function* () {
	const admitted = new Set(["team"]);
	const reactivity = yield* Reactivity.make;
	const sessions = {
		origin: () => true,
		provider: {
			get: (headers: Readonly<Record<string, string>>) => Effect.succeed(Option.map(Option.fromUndefinedOr(headers.authorization), providerSession)),
		},
	};
	const handlers = Documents.application
		.toLayer({
			"documents.compare": ({ account }) => Effect.succeed(`${account}'s document`),
			"documents.get": ({ account }) => Effect.succeed(`${account}'s document`),
		})
		.pipe(
			Layer.provide([
				Layer.succeed(ReadAccess, readAccess(admitted)),
				Layer.succeed(SessionUserWithProviderAccounts, {
					email: "stale@example.test",
					id: "stale",
					name: "stale",
					providerAccounts: Effect.succeed([]),
				}),
			]),
			Layer.provideMerge(authenticatedUserWithProviderAccountsLayer(sessions)),
		);
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Documents,
			handlers,
			services: LiveServer.layer.pipe(Layer.provide(Layer.succeed(Reactivity.Reactivity, reactivity))),
			sessions,
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	function open(person: Person, transport: "http" | "socket") {
		const protocol =
			transport === "http"
				? RpcClient.layerProtocolHttp({
						transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", person)),
						url,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))
				: RpcClient.layerProtocolSocket().pipe(
						Layer.provide([layerWebSocket(url.replace(/^http/u, "ws"), { headers: { authorization: person } }), RpcSerialization.layerNdjson]),
					);
		return Effect.flatMap(Layer.build(protocol), (context) => RpcClient.make(Documents, { flatten: true }).pipe(Effect.provideContext(context)));
	}
	return { admitted, open, reactivity };
});
