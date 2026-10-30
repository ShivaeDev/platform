import { createServer } from "node:net";
import { getMigrations } from "better-auth/db/migration";
import { admin, jwt, testUtils } from "better-auth/plugins";
import { Effect, Layer } from "effect";
import type { McpClient } from "effect/ai";
import { RpcGroup } from "effect/rpc";
import { authDatabase, betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { trustedOrigins } from "@shivaedev/identity/server/origin.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
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

const startHost = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const port = yield* Effect.promise(availablePort);
	const baseUrl = `http://127.0.0.1:${port}`;
	const resource = `${baseUrl}/mcp`;
	const options = {
		"baseURL": baseUrl,
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
			}),
		],
		secret: "mcp-story-secret-with-at-least-thirty-two-characters",
		trustedOrigins: [baseUrl],
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options, { roles: Roles });
	const oauth = yield* betterAuthMcp({ auth: mounted.auth, origin: trustedOrigins({ allow: [baseUrl], missing: "allow" }), resource, roles: Roles });
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
					sessions: oauth.sessions,
					version: "1",
				}),
			),
			sessions: { ...mounted.sessions, origin: () => true },
		}).pipe(Layer.provide(jwks.logger)),
	);
	return { auth: mounted.auth, baseUrl, jwks, resource };
});
type Host = Effect.Success<typeof startHost>;

interface Person {
	readonly cookie: string;
	readonly id: string;
}

interface Story {
	readonly clients: Map<string, McpClient.McpClient>;
	readonly flow: { clientId?: string; code?: string; consentQuery?: string };
	readonly people: Map<string, Person>;
	refusal: { readonly challenge: string | undefined; readonly status: number } | undefined;
	readonly tokens: Map<string, string>;
}

export const startEngine = Effect.map(startHost, (host): Host & Story => ({
	...host,
	clients: new Map(),
	flow: {},
	people: new Map(),
	refusal: undefined,
	tokens: new Map(),
}));
export type Engine = Effect.Success<typeof startEngine>;

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
