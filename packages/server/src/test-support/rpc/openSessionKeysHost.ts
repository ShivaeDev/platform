import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Option, Schema } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { Migrator } from "effect/sql";
import { LiveHint } from "@shivaedev/contract/live.ts";
import { authorizeReads } from "@shivaedev/contract/readPolicy.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Identity } from "@shivaedev/identity/identity.ts";
import { betterAuthSessions } from "@shivaedev/identity/server/adapters/betterAuthSessions.ts";
import { commandChanges } from "@shivaedev/identity/server/commandChanges.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import {
	authenticatedUserLayer,
	authenticatedUserWithProviderAccountsLayer,
	resolveSession,
	type SessionShape,
} from "@shivaedev/identity/server/session.ts";
import { ManagementPermission, TestRoles, ToolsPermission } from "@shivaedev/identity/test-support/auth/permissions.ts";
import type { Provider } from "@shivaedev/identity/test-support/rpc/harness.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { appHost } from "#appHost.ts";
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

export const openSessionKeysHost = Effect.fnUntraced(function* (provider: Provider, trustedProxy?: string) {
	const database = yield* PostgresTestDatabase;
	const lookup = betterAuthSessions(provider.getSession);
	const sessions = {
		origin: () => true,
		provider: {
			get: (headers: Parameters<typeof lookup.get>[0]) => lookup.get(headers).pipe(Effect.map(Option.map((session) => sessionWithAccounts(session)))),
		},
		roles: TestRoles,
		streamRevalidationInterval: "50 millis" as const,
	};
	const customAuth = Layer.succeed(CustomAuthenticated, (effect, { headers, rpc, payload }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(sessions, headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Sign in" });
			}
			return yield* authorizeReads(commandChanges(effect, rpc, payload), { payload, rpc }, Option.some({ id: session.value.user.id })).pipe(
				Effect.provideService(Identity, { id: session.value.user.id }),
			);
		}),
	);
	const published: (readonly unknown[])[] = [];
	const context = yield* Layer.build(
		Layer.fresh(
			appHost({
				config: { databaseUrl: database.url, port: 0, ...(trustedProxy === undefined ? {} : { trustedProxy }) },
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
	const connections: string[] = [];
	const socketConstructor = Layer.effect(
		Socket.WebSocketConstructor,
		Effect.map(Socket.WebSocketConstructor, (make) => (address, options) => {
			connections.push(address);
			return make(address, options);
		}),
	).pipe(Layer.provide(layerWebSocketConstructorWS));
	function protocol(cookie = "") {
		return RpcClient.layerProtocolSocket().pipe(
			Layer.provide([
				Socket.layerWebSocket(url.replace(/^http/u, "ws"), { headers: { cookie } }).pipe(Layer.provide(socketConstructor)),
				RpcSerialization.layerNdjson,
			]),
		);
	}
	function client(cookie = "") {
		return Effect.flatMap(Layer.build(protocol(cookie)), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
	}
	function wireClient(cookie: string) {
		return Effect.flatMap(Layer.build(protocol(cookie)), (services) => RpcClient.make(Wire, { flatten: true }).pipe(Effect.provideContext(services)));
	}
	return { client, connections, published, url, wireClient };
});
