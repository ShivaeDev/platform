import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { RepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { ChangeObserver } from "@shivaedev/sql/transact.ts";
import { Account } from "#Account.ts";
import { Account as AccountClient } from "#generated/Account.ts";
import { SessionUser, SessionUserSchema } from "#identity.ts";
import { AuthenticatedUser } from "#middleware.ts";
import { accountDeletion } from "#server/better-auth/accountDeletion.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { authenticatedUserLayer } from "#server/session.ts";
import { recordPublished } from "#test/recordPublished.ts";
import { ORIGIN } from "#test/rpc/harness.ts";

const Profile = contract("profile", {
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: SessionUserSchema })],
}).middleware(AuthenticatedUser);
const ServedApi = Account.merge(Profile);
const Api = AccountClient.merge(Profile);

export const accountDeletionHost = Effect.fnUntraced(function* <E>(
	handOver: (userId: string) => Effect.Effect<void, E, SqlClient.SqlClient>,
	announced: unknown[],
) {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "account-deletion-story-secret-with-32-characters",
		session: { cookieCache: { enabled: false }, disableSessionRefresh: true },
		user: { deleteUser: { enabled: true } },
	};
	yield* migrateBetterAuth({ options });
	const mounted = yield* betterAuthMount({ options })
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const sql = yield* SqlClient.SqlClient;
	const story = Layer.mergeAll(
		Layer.succeed(SqlClient.SqlClient, sql),
		Layer.succeed(RepositoryModels, yield* RepositoryModels),
		Layer.succeed(ChangeObserver, recordPublished(announced)),
	);
	const application = Layer.merge(
		moduleHandlers(Account).pipe(Layer.provide(accountDeletion({ options }, { handOver }))),
		Profile.application.toLayer({ "profile.read": () => SessionUser }),
	);
	const rpc = RpcServer.layerHttp({ group: ServedApi, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([application, authenticatedUserLayer(), RpcSerialization.layerNdjson]),
		Layer.provide(story),
	);
	const app = HttpRouter.toWebHandler(
		Layer.merge(mounted.routes, rpc).pipe(
			Layer.provide(Reactivity.layer),
			Layer.provide(Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true })),
		),
		{ disableLogger: true },
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	return {
		auth: mounted.auth,
		client: (headers: Headers) =>
			RpcClient.make(Api).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(Object.fromEntries(headers))),
						url: `${ORIGIN}/rpc`,
					}).pipe(
						Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
						Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
					),
				),
			),
		fetch: (path: string, init: RequestInit = {}) => Effect.promise(() => app.handler(new Request(`${ORIGIN}${path}`, init))),
	};
});

export type AccountDeletionHost = Effect.Success<ReturnType<typeof accountDeletionHost>>;
