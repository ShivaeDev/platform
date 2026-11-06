import { createServer } from "node:net";
import { getMigrations } from "better-auth/db/migration";
import { admin, jwt } from "better-auth/plugins";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { trustedOrigins } from "@shivaedev/identity/server/adapters/trustedOrigins.ts";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/adapters/mount.ts";
import { betterAuthOauthGrants } from "@shivaedev/identity/server/better-auth/adapters/oauthGrants.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { betterAuthMcp, mcpProvider } from "#adapters/betterAuth.ts";
import { mcpRoutes } from "#routes.ts";
import { admissionPolicy } from "./admissionPolicy.ts";
import { BrowserApi, browserHandlers } from "./browserRpc.ts";
import { hashGrantToken } from "./hashGrantToken.ts";
import { jwksEndpoint } from "./jwksEndpoint.ts";
import { tokenSigner } from "./tokenSigner.ts";
import { audiences, Roles } from "./tools.ts";

async function availablePort() {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	await new Promise<void>((resolve) => server.close(() => resolve()));
	return address.port;
}

export const POLICY_ONLY_ORIGIN = "https://policy-only.mcp.test";
export const TRANSPORT_ONLY_ORIGIN = "https://transport-only.mcp.test";

export interface HostOptions {
	readonly inProcess?: boolean;
	readonly issuerPath?: string;
	readonly withAdmission?: boolean;
}

export const startHost = Effect.fnUntraced(function* ({ inProcess, withAdmission, issuerPath }: HostOptions) {
	const admission = yield* admissionPolicy;
	const pool = yield* betterAuthDatabase();
	const port = yield* Effect.promise(availablePort);
	const baseUrl = `http://127.0.0.1:${port}`;
	const publicUrl = inProcess ? "https://mcp.story.test" : baseUrl;
	const resource = `${publicUrl}/mcp`;
	const options = {
		"baseURL": { allowedHosts: ["127.0.0.1:*", "mcp.story.test"], fallback: publicUrl },
		database: pool,
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [
			admin(),
			jwt(issuerPath === undefined ? {} : { jwt: { issuer: `${publicUrl}${issuerPath}` } }),
			mcpProvider({
				allowDynamicClientRegistration: true,
				allowUnauthenticatedClientRegistration: true,
				consentPage: "/consent",
				loginPage: "/login",
				resource,
				scopes: ["mcp", "offline_access"],
				storeTokens: { hash: hashGrantToken },
			}),
		],
		secret: "mcp-story-secret-with-at-least-thirty-two-characters",
		trustedOrigins: [baseUrl],
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, {
		defaultRole: "user",
		roles: Roles,
		...(withAdmission ? { signIn: admission.policy } : {}),
	}).pipe(Effect.provide(memoryStore));
	const grants = betterAuthOauthGrants({ admitsUser: mounted.admitsUser, auth: mounted.auth });
	const tokens = tokenSigner();
	const jwks = jwksEndpoint(mounted.auth, tokens.jwk);
	const oauth = yield* betterAuthMcp({
		auth: mounted.auth,
		...(inProcess ? { jwks: jwks.keys } : {}),
		origin: trustedOrigins({ allow: [baseUrl, POLICY_ONLY_ORIGIN], missing: "allow" }),
		resource,
		roles: Roles,
	}).pipe(Effect.provide(grants));
	yield* Layer.build(
		appHost({
			config: { port },
			group: BrowserApi,
			handlers: browserHandlers,
			routes: Layer.mergeAll(
				jwks.routes,
				mounted.routes,
				oauth.routes,
				mcpRoutes({
					allowedOrigins: [baseUrl, TRANSPORT_ONLY_ORIGIN],
					audiences,
					name: "Story app",
					path: "/mcp",
					resourceMetadataUrl: oauth.resourceMetadataUrl,
					version: "1",
				}).pipe(HttpRouter.provideRequest(oauth.sessions)),
			),
			sessions: Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true }),
		}).pipe(Layer.provide(jwks.logger)),
	);
	return {
		admission: admission.state,
		auth: mounted.auth,
		baseUrl,
		grants,
		issuer: `${publicUrl}${issuerPath ?? "/api/auth"}`,
		jwks,
		oauth,
		resource,
		signToken: tokens.sign,
	};
});
