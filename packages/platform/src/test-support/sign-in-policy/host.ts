import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { type Cause, ConfigProvider, Effect, Layer, type Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { Identity } from "#rpc/identity.ts";
import { Authenticated } from "#rpc/middleware.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import type { SignInPolicy } from "#server/better-auth/signInGate.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { authenticatedLayer } from "#server/rpc-server/session.ts";

const Api = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String })).middleware(Authenticated);
const handlers = Api.toLayer({ Whoami: () => Effect.map(Identity, ({ id }) => id) });

export const policyHost = Effect.fnUntraced(function* (
	databaseUrl: Redacted.Redacted<string>,
	env: Record<string, string>,
	signIn: SignInPolicy<Cause.UnknownError> | undefined,
) {
	const pool = yield* authDatabase(databaseUrl);
	const options = {
		database: pool,
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		secret: "sign-in-policy-story-secret-with-32-characters",
		session: { cookieCache: { enabled: false } },
		socialProviders: { github: { clientId: "story-client", clientSecret: "story-secret" } },
	} satisfies BetterAuthOptions;
	yield* Effect.promise(async () => {
		await (await getMigrations(options)).runMigrations();
	});
	const mounted = yield* betterAuthMount(options, { signIn }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	const sessions = {
		origin: () => true,
		provider: betterAuthSessions(mounted.admittedSessions((headers) => mounted.auth.api.getSession({ headers }))),
	};
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, authenticatedLayer(sessions), RpcSerialization.layerJson]),
	);
	const context = yield* Layer.build(
		HttpRouter.serve(Layer.merge(mounted.routes, rpc), { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
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
					transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin: baseUrl })),
					url: `${baseUrl}/rpc`,
				}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson])),
			),
			Effect.scoped,
		);
	}
	async function storedSessions() {
		const { internalAdapter } = await mounted.auth.$context;
		const users = await internalAdapter.listUsers(100, 0, { direction: "asc", field: "email" });
		return Object.fromEntries(
			await Promise.all(users.map(async ({ email, id }) => [email, (await internalAdapter.listSessions(id)).length] as const)),
		);
	}
	return { baseUrl, revokeUnadmitted: mounted.revokeUnadmitted, storedSessions, whoami };
});

export type PolicyHost = Effect.Success<ReturnType<typeof policyHost>>;
