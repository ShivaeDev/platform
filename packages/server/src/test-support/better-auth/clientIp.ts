import { Effect } from "effect";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { postgres } from "@shivaedev/identity/test-support/better-auth/postgres.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clientIpHost } from "./clientIpHost.ts";

interface Engine {
	readonly env: Record<string, string>;
	host?: Effect.Success<ReturnType<typeof clientIpHost>>;
}

export const clientIp = storyKit({
	after: {
		*configured(engine) {
			const database = yield* PostgresTestDatabase;
			engine.host = yield* clientIpHost(database.url, engine.env);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): Engine => ({ env: { "TRUSTED_PROXY": "127.0.0.1" } }),
	inspect: (engine) => ({ env: engine.env, url: engine.host?.baseUrl }),
	layer: postgres,
	name: "auth client IP through appHost",
	stages: ["configured"],
	verbs: (engine, story) => {
		const host = engine.host;
		if (host === undefined) {
			throw new Error("The client IP story host has not started");
		}
		const { baseUrl, pool } = host;
		function emailRequest(path: string, headers: Record<string, string>) {
			return Effect.promise(async () => {
				const response = await fetch(`${baseUrl}/api/auth/${path}/email`, {
					body: JSON.stringify({ email: "alice@example.test", name: "Alice", password: "story-password-123" }),
					headers: { "content-type": "application/json", origin: baseUrl, ...headers },
					method: "POST",
				});
				await response.text();
				return response.status;
			});
		}
		return {
			signIn: (headers: Record<string, string>) => {
				story.tell(`Alice signs in over HTTP with ${JSON.stringify(headers)}`);
				return emailRequest("sign-in", headers);
			},
			signUp: () => {
				story.tell("Alice registers an email and password over HTTP without signing in");
				return emailRequest("sign-up", {});
			},
			storedSessions: () => {
				story.tell("read the session IP addresses stored in PostgreSQL");
				return authTestDatabase(pool).sessionIpAddresses;
			},
		};
	},
});

export function proxyEnvironment(env: Record<string, string>) {
	return clientIp.trait("configured", `proxy configuration is ${JSON.stringify(env)}`, (engine) => {
		Object.assign(engine.env, env);
	});
}
