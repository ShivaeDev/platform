import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import type { BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { type Cause, ConfigProvider, Effect, Layer, type Redacted, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { Identity } from "#identity.ts";
import { Authenticated } from "#middleware.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import type { SignInPolicy } from "#server/better-auth/signInGate.ts";
import { authenticatedLayer } from "#server/session.ts";

const Api = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String })).middleware(Authenticated);
const handlers = Api.toLayer({ Whoami: () => Effect.map(Identity, ({ id }) => id) });

export const policyHost = Effect.fnUntraced(function* (
	databaseUrl: Redacted.Redacted<string>,
	env: Record<string, string>,
	signIn: SignInPolicy<Cause.UnknownError> | undefined,
	app: { readonly sessionsOpen: boolean },
) {
	const pool = yield* authDatabase(databaseUrl);
	const options = {
		database: pool,
		databaseHooks: { session: { create: { before: async (session) => (app.sessionsOpen ? { data: session } : false) } } },
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
	async function storedUsers() {
		const { internalAdapter } = await mounted.auth.$context;
		const users = await internalAdapter.listUsers(1000, 0, { direction: "asc", field: "email" });
		return users.map(({ email }) => email);
	}
	async function sessionDevices(email: string) {
		const { internalAdapter } = await mounted.auth.$context;
		const user = await internalAdapter.findUserByEmail(email);
		if (user === null) {
			return [];
		}
		const held = await internalAdapter.listSessions(user.user.id);
		return held.map(({ userAgent }) => userAgent ?? "").sort();
	}
	async function seedGitHubUsers(count: number, now: Date) {
		const { adapter } = await mounted.auth.$context;
		for (let index = 0; index < count; index += 1) {
			const user = await adapter.create<{ readonly id: string }>({
				data: { createdAt: now, email: `seeded-${index}@github.test`, emailVerified: true, name: `seeded ${index}`, updatedAt: now },
				model: "user",
			});
			await adapter.create({
				data: { accountId: String(5000 + index), createdAt: now, providerId: "github", updatedAt: now, userId: user.id },
				model: "account",
			});
			await adapter.create({
				data: { createdAt: now, expiresAt: new Date(now.getTime() + 3_600_000), token: `seeded-${index}`, updatedAt: now, userId: user.id },
				model: "session",
			});
		}
	}
	async function sessionHolders() {
		const { adapter } = await mounted.auth.$context;
		const held = await adapter.findMany<{ readonly userId: string }>({ limit: 1000, model: "session" });
		const users = await adapter.findMany<{ readonly email: string }>({
			model: "user",
			where: [{ field: "id", operator: "in", value: held.map(({ userId }) => userId) }],
		});
		return users.map(({ email }) => email).sort();
	}
	return { baseUrl, revokeUnadmitted: mounted.revokeUnadmitted, seedGitHubUsers, sessionDevices, sessionHolders, storedUsers, whoami };
});

export type PolicyHost = Effect.Success<ReturnType<typeof policyHost>>;
