import { request } from "node:http";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
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
	name: "auth client IP through the mounted identity routes",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (engine, story) => {
		const host = engine.host;
		if (host === undefined) {
			throw new Error("The client IP story host has not started");
		}
		const { baseUrl, pool } = host;

		return {
			signIn: (headers: Record<string, string>, peer?: string) => {
				story.tell(`Alice signs in over HTTP with ${JSON.stringify(headers)}`);
				return emailRequest(baseUrl, "sign-in", headers, peer);
			},
			signUp: () => {
				story.tell("Alice registers an email and password over HTTP without signing in");
				return emailRequest(baseUrl, "sign-up", engine.env.PUBLIC_URL === undefined ? {} : { origin: engine.env.PUBLIC_URL });
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

export const noProxy = clientIp.trait("configured", "no trusted proxy is configured", (engine) => {
	delete engine.env.TRUSTED_PROXY;
});

function emailRequest(baseUrl: string, path: string, headers: Record<string, string>, localAddress = "127.0.0.1") {
	return emailResponse(baseUrl, path, headers, localAddress).pipe(Effect.map((response) => response.status));
}

function emailResponse(baseUrl: string, path: string, headers: Record<string, string>, localAddress = "127.0.0.1") {
	return Effect.promise(
		() =>
			new Promise<{ status: number; cookies: readonly string[] }>((resolve, reject) => {
				const outgoing = request(
					`${baseUrl}/api/auth/${path}/email`,
					{
						headers: { "content-type": "application/json", origin: baseUrl, ...headers },
						localAddress,
						method: "POST",
					},
					(response) => {
						response.resume();
						response.on("end", () => resolve({ cookies: response.headers["set-cookie"] ?? [], status: response.statusCode ?? 0 }));
					},
				);
				outgoing.on("error", reject);
				outgoing.end(JSON.stringify({ email: "alice@example.test", name: "Alice", password: "story-password-123" }));
			}),
	);
}
