import { Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { Migrator } from "effect/sql";
import { LiveHint } from "@shivaedev/contract/live.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { Identity } from "#rpc/identity.ts";
import { appHost } from "#server/appHost.ts";
import { sessionCommandChanges } from "#server/commandChanges.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { permissionLayer } from "#server/rpc-server/permissions.ts";
import { authenticatedUserLayer, authenticatedUserWithProviderAccountsLayer, resolveSession, type SessionShape } from "#server/rpc-server/session.ts";
import { ManagementPermission, TestRoles, ToolsPermission } from "#test/auth/permissions.ts";
import type { Provider } from "./harness.ts";
import { Api, CustomAuthenticated, handlers } from "./sessionKeysApi.ts";

const Wire = RpcGroup.make(
	Rpc.make("account.$changes", {
		payload: Schema.Unknown,
		stream: true,
		success: LiveHint,
	}),
);

function sessionWithAccounts<TSession extends SessionShape>(session: TSession) {
	return { ...session, user: { ...session.user, providerAccounts: Effect.succeed([]), role: "admin,owner" } };
}

export const openSessionKeysHost = Effect.fnUntraced(function* (provider: Provider) {
	const database = yield* PostgresTestDatabase;
	const lookup = betterAuthSessions(provider.getSession);
	const sessions = {
		origin: () => true,
		provider: {
			get: (headers: Parameters<typeof lookup.get>[0]) => lookup.get(headers).pipe(Effect.map(Option.map((session) => sessionWithAccounts(session)))),
		},
		roles: TestRoles,
	};
	const customAuth = Layer.succeed(CustomAuthenticated, (effect, { headers, rpc, payload }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(sessions, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Sign in" });
			}
			return yield* sessionCommandChanges(effect, rpc, payload).pipe(Effect.provideService(Identity, { id: session.value.user.id }));
		}),
	);
	const published: (readonly unknown[])[] = [];
	const context = yield* Layer.build(
		Layer.fresh(
			appHost({
				config: { databaseUrl: database.url, port: 0 },
				group: Api,
				handlers: handlers.pipe(
					Layer.provideMerge(
						Layer.mergeAll(
							authenticatedUserLayer(sessions),
							authenticatedUserWithProviderAccountsLayer(sessions),
							permissionLayer(ToolsPermission, sessions),
							permissionLayer(ManagementPermission, sessions),
							customAuth,
						),
					),
				),
				migrations: { loader: Migrator.fromRecord({}) },
				services: Layer.succeed(ChangeObserver, (event) =>
					Effect.sync(() => {
						if (event._tag === "Published") {
							published.push(event.changes);
						}
					}),
				),
				sessions,
			}),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP server");
	}
	const url = `http://127.0.0.1:${server.address.port}/rpc`;
	function protocol(cookie = "") {
		return RpcClient.layerProtocolHttp({
			transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeaders({ cookie })),
			url,
		}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	}
	function client(cookie = "") {
		return RpcClient.make(Api, { flatten: true }).pipe(Effect.provide(protocol(cookie)));
	}
	function wireClient(cookie: string) {
		return RpcClient.make(Wire, { flatten: true }).pipe(Effect.provide(protocol(cookie)));
	}
	return { client, published, url, wireClient };
});
