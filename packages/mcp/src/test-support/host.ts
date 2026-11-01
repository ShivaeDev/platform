import { createServer } from "node:net";
import { getMigrations } from "better-auth/db/migration";
import { admin, jwt, testUtils } from "better-auth/plugins";
import { Effect, Layer } from "effect";
import type { McpClient } from "effect/ai";
import { HttpRouter } from "effect/http";
import { RpcGroup } from "effect/rpc";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { betterAuthMcp, mcpProvider } from "#adapters/betterAuth.ts";
import { mcpRoutes } from "#routes.ts";
import { jwksEndpoint } from "./jwksEndpoint.ts";
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

const startHost = Effect.fnUntraced(function* (inProcess: boolean) {
	const pool = yield* betterAuthDatabase();
	const port = yield* Effect.promise(availablePort);
	const baseUrl = `http://127.0.0.1:${port}`;
	const publicUrl = inProcess ? "https://mcp.story.test" : baseUrl;
	const resource = `${publicUrl}/mcp`;
	const options = {
		"baseURL": { allowedHosts: ["127.0.0.1:*", "mcp.story.test"], fallback: publicUrl },
		database: pool,
		logger: { disabled: true },
		plugins: [
			admin(),
			jwt(),
			testUtils(),
			mcpProvider({
				allowDynamicClientRegistration: true,
				allowUnauthenticatedClientRegistration: true,
				consentPage: "/consent",
				loginPage: "/login",
				resource,
				scopes: ["mcp", "offline_access"],
			}),
		],
		secret: "mcp-story-secret-with-at-least-thirty-two-characters",
		trustedOrigins: [baseUrl],
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, { defaultRole: "user", roles: Roles });
	const oauth = yield* betterAuthMcp({
		auth: mounted.auth,
		...(inProcess ? { jwks: () => mounted.auth.api.getJwks() } : {}),
		origin: trustedOrigins({ allow: [baseUrl], missing: "allow" }),
		resource,
		roles: Roles,
	});
	const group = RpcGroup.make();
	const jwks = jwksEndpoint(mounted.auth);
	yield* Layer.build(
		appHost({
			config: { port },
			group,
			handlers: group.toLayer({}),
			routes: Layer.mergeAll(
				jwks.routes,
				mounted.routes,
				oauth.routes,
				mcpRoutes({
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
	return { auth: mounted.auth, baseUrl, issuer: `${publicUrl}/api/auth`, jwks, oauth, resource };
});
type Host = Effect.Success<ReturnType<typeof startHost>>;

interface Person {
	readonly cookie: string;
	readonly id: string;
}

interface Story {
	readonly clientIds: Map<string, string>;
	readonly clients: Map<string, McpClient.McpClient>;
	readonly flow: { clientId?: string; code?: string; consentQuery?: string };
	readonly people: Map<string, Person>;
	readonly refreshTokens: Map<string, string>;
	refusal: { readonly challenge: string | undefined; readonly status: number } | undefined;
	readonly tokens: Map<string, string>;
}

export function startEngine(inProcess = false) {
	return Effect.map(startHost(inProcess), (host): Host & Story => ({
		...host,
		clientIds: new Map(),
		clients: new Map(),
		flow: {},
		people: new Map(),
		refreshTokens: new Map(),
		refusal: undefined,
		tokens: new Map(),
	}));
}
export type Engine = Effect.Success<ReturnType<typeof startEngine>>;

export function person(engine: Engine, name: string) {
	const found = engine.people.get(name);
	if (found === undefined) {
		throw new Error(`${name} is not signed in`);
	}
	return found;
}

export function named(engine: Engine, text: string) {
	let replaced = text;
	for (const [name, { id }] of engine.people) {
		replaced = replaced.replaceAll(id, name);
	}
	return replaced;
}

export function path(engine: Engine, url: string) {
	return url.startsWith(engine.baseUrl) ? url.slice(engine.baseUrl.length) : url;
}
