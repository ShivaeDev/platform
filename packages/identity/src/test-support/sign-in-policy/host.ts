import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { type Cause, ConfigProvider, Effect, Layer, type Redacted, Schema } from "effect";
import { FetchHttpClient, Headers, HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { Identity } from "#identity.ts";
import { Authenticated, RequestTracing } from "#middleware.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import type { SignInPolicy } from "#server/better-auth/signInGate.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { authenticatedLayer, authenticatedUserWithProviderAccountsLayer } from "#server/session.ts";
import { requestTracingLayer } from "#server/tracing.ts";
import { ProviderAccounts, providerAccountHandlers, readProviderAccounts } from "#test/better-auth/providerAccounts.ts";
import { recorder } from "#test/rpc/harness.ts";
import { storedPolicy } from "./stored.ts";

const Api = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String }))
	.middleware(Authenticated)
	.middleware(RequestTracing);
const handlers = Api.toLayer({ Whoami: () => Effect.map(Identity, ({ id }) => id) });

export const policyHost = Effect.fnUntraced(function* (
	databaseUrl: Redacted.Redacted<string>,
	env: Record<string, string>,
	signIn: SignInPolicy<Cause.UnknownError> | undefined,
	app: { readonly sessionsOpen: boolean; readonly providerAccounts?: boolean },
) {
	const pool = yield* authDatabase(databaseUrl);
	const options = {
		database: pool,
		databaseHooks: { session: { create: { before: async (session) => (app.sessionsOpen ? { data: session } : false) } } },
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "sign-in-policy-story-secret-with-32-characters",
		session: { cookieCache: { enabled: false } },
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => {
		await (await getMigrations(options)).runMigrations();
	});
	const mounted = yield* betterAuthMount(options, { signIn }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	let accountLookups = 0;
	const accounts = app.providerAccounts
		? mounted.admittedSessions(
				(headers) => mounted.auth.api.getSession({ headers }),
				(headers) => {
					accountLookups += 1;
					return mounted.auth.api.listUserAccounts({ headers });
				},
			)
		: undefined;
	const sessions = {
		origin: () => true,
		provider: accounts ?? mounted.sessions.provider,
	};
	const accountRpc =
		accounts === undefined
			? Layer.empty
			: RpcServer.layerHttp({ group: ProviderAccounts, path: "/accounts", protocol: "http" }).pipe(
					Layer.provide([
						providerAccountHandlers,
						authenticatedUserWithProviderAccountsLayer({ ...sessions, provider: accounts }),
						RpcSerialization.layerNdjson,
					]),
				);
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, authenticatedLayer(sessions), requestTracingLayer(), RpcSerialization.layerJson]),
	);
	const recorded = recorder();
	const context = yield* Layer.build(
		HttpRouter.serve(Layer.mergeAll(mounted.routes, rpc, accountRpc), { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
			Layer.provide(recorded.layer),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("The sign-in policy host needs a TCP listener");
	}
	const baseUrl = `http://127.0.0.1:${server.address.port}`;
	function whoami(cookie: string) {
		return Effect.gen(function* () {
			const client = yield* RpcClient.make(Api);
			return yield* Effect.result(client.Whoami());
		}).pipe(
			Effect.provide(
				RpcClient.layerProtocolHttp({
					transformClient: (client) =>
						HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin: baseUrl, "x-request-id": "policy-request" })),
					url: `${baseUrl}/rpc`,
				}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
			),
			Effect.scoped,
		);
	}
	function resolveSession(cookie: string) {
		return sessions.provider
			.get(Headers.fromInput({ cookie, host: new URL(baseUrl).host }))
			.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	}
	return {
		...storedPolicy(mounted.auth),
		accountLookups: () => accountLookups,
		baseUrl,
		logs: recorded.logs,
		mintSession: (person: string, accountId: string) =>
			Effect.promise(() =>
				signedInUser(betterAuth(options), {
					email: `${person}@github.test`,
					name: person,
					providerAccounts: [{ accountId, providerId: "github" }],
				}),
			),
		providerAccounts: (cookie: string) =>
			readProviderAccounts(
				baseUrl,
				(input, init) => {
					const request = new Request(input, init);
					request.headers.set("cookie", cookie);
					return fetch(request);
				},
				"providerAccounts",
				"/accounts",
			),
		resolveSession,
		revokeUnadmitted: mounted.revokeUnadmitted.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env })))),
		spans: recorded.spans,
		whoami,
	};
});

export type PolicyHost = Effect.Success<ReturnType<typeof policyHost>>;
