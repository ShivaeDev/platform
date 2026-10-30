import { ConfigProvider, Effect, Layer, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { SessionUserWithProviderAccounts } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "@shivaedev/identity/middleware.ts";
import { allowedAccounts } from "@shivaedev/identity/server/better-auth/allowedAccounts.ts";
import { authDatabase, betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { authenticatedUserWithProviderAccountsLayer } from "@shivaedev/identity/server/session.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { AppAccess } from "#AppAccess.ts";
import { authOptions } from "#server/authOptions.ts";
import { migrateDatabase } from "#server/migrateDatabase.ts";
import { secret } from "./host.ts";

const Api = RpcGroup.make(
	Rpc.make("Accounts", {
		error: Schema.Union([AuthUnavailable, Unauthorized]),
		success: Schema.Array(Schema.Struct({ accountId: Schema.String, providerId: Schema.String })),
	}),
).middleware(AuthenticatedUserWithProviderAccounts);
const handlers = Api.toLayer({ Accounts: () => Effect.flatMap(SessionUserWithProviderAccounts, (user) => user.providerAccounts) });

export const admittedHost = Effect.fn("AdmittedStory.admittedHost")(function* (env: Record<string, string>) {
	const database = yield* PostgresTestDatabase;
	yield* Effect.scoped(migrateDatabase(database.url));
	const pool = yield* authDatabase(database.url);
	const mounted = yield* betterAuthMount(
		{
			...authOptions(pool),
			secret: Redacted.value(secret),
			socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
		},
		{ roles: AppAccess, signIn: { accounts: allowedAccounts } },
	);
	const sessions = {
		...mounted.sessions,
		origin: () => true,
		provider: mounted.admittedSessions(
			(headers) => mounted.auth.api.getSession({ headers }),
			(headers) => mounted.auth.api.listUserAccounts({ headers }),
		),
	};
	const context = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Api,
			handlers: Layer.merge(handlers, authenticatedUserWithProviderAccountsLayer(sessions)),
			routes: mounted.routes,
			sessions,
		}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The admitted starter host needs a TCP listener");
	}
	const baseUrl = `http://127.0.0.1:${server.address.port}`;
	return {
		baseUrl,
		providerAccounts: (cookie: string) =>
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Api);
				return yield* client.Accounts();
			}).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin: baseUrl })),
						url: `${baseUrl}/rpc`,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
				Effect.scoped,
			),
		revoke: mounted.revokeUnadmitted,
	};
});
