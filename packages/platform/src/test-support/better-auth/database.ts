import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { authTestUtils, signedInUser } from "#server/better-auth/testing.ts";
import { databaseUrl, postgres } from "./postgres.ts";

export const authStorage = storyKit({
	after: {
		*hosting(engine) {
			const mounted = yield* betterAuthMount(engine.options).pipe(
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
			);
			const context = yield* Layer.build(
				HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
					Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
				),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Auth storage stories require a TCP listener");
			}
			engine.baseUrl = `http://127.0.0.1:${server.address.port}`;
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const pool = yield* authDatabase(database.url);
		const options = {
			advanced: { database: { validateSchema: true } },
			database: pool,
			emailAndPassword: { enabled: true },
			logger: { disabled: true },
			secret: "auth-storage-story-secret-with-at-least-32-characters",
			session: { cookieCache: { enabled: false } },
		};
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		return {
			auth: betterAuth({ ...options, "baseURL": "http://127.0.0.1:3000", plugins: [authTestUtils()] }),
			baseUrl: "",
			headers: new Map<string, Headers>(),
			options,
			storage: authTestDatabase(pool),
		};
	},
	inspect: (engine) => ({ accounts: [...engine.headers.keys()], baseUrl: engine.baseUrl }),
	layer: postgres,
	name: "auth storage fixtures",
	runIf: databaseUrl !== undefined,
	stages: ["accounts", "schema", "hosting"],
	verbs: (engine, story) => ({
		expireSessions: () => {
			story.tell("stored auth sessions expire");
			return engine.storage.expireSessions;
		},
		session: (name: string) =>
			Effect.tryPromise(async () => {
				story.tell(`${name} requests the mounted auth session over HTTP`);
				const headers = engine.headers.get(name);
				if (headers === undefined) {
					throw new Error(`No minted account exists for ${name}`);
				}
				const response = await fetch(`${engine.baseUrl}/api/auth/get-session`, { headers });
				const body: unknown = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
				return { body, status: response.status };
			}),
		storedSessions: () => engine.storage.sessions,
		storedUsers: () => engine.storage.users,
	}),
});

export function mintedAccounts() {
	return authStorage.trait("accounts", "Alice and Bob already hold independent auth sessions", function* (engine) {
		for (const name of ["alice", "bob"]) {
			const { headers } = yield* Effect.promise(() => signedInUser(engine.auth, { email: `${name}@storage.test`, name }));
			engine.headers.set(name, headers);
		}
	});
}

export function missingImageColumn() {
	return authStorage.trait("schema", "the default auth schema is missing its user image column", (engine) => engine.storage.omitImageColumn);
}
