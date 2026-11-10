import { request } from "node:http";
import { Effect } from "effect";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { clientIpHost, STORY_PEER_HEADER } from "#test/better-auth/clientIpHost.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

interface Engine {
	env: Record<string, string>;
	host?: Effect.Success<ReturnType<typeof clientIpHost>>;
}

export const clientIp = storyKit({
	after: {
		*configured(engine) {
			engine.host = yield* clientIpHost(engine.env).pipe(Effect.provide(memoryStore));
		},
	},
	around: withIdentityDatabase,
	clock: storyClock,
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
		const { baseUrl } = host;

		return {
			recordedSignInLimits: () => {
				story.tell("read the sign-in HTTP spans' rate-limit address, source and response status");
				return Effect.sync(() =>
					host.spans
						.filter((span) => span.kind === "server" && span.attributes.get("url.path") === "/api/auth/sign-in/email")
						.map((span) => ({
							address: span.attributes.get("auth.rate_limit.address"),
							source: span.attributes.get("auth.rate_limit.address_source"),
							status: span.attributes.get("http.response.status_code"),
						})),
				);
			},
			signIn: (headers: Record<string, string>, peer?: string) => {
				story.tell(`Alice signs in over HTTP with ${JSON.stringify(headers)}${peer === undefined ? "" : ` from peer ${peer}`}`);
				return emailRequest(baseUrl, "sign-in", peer === undefined ? headers : { ...headers, [STORY_PEER_HEADER]: peer });
			},
			signUp: () => {
				story.tell("Alice registers an email and password over HTTP without signing in");
				return emailRequest(baseUrl, "sign-up", engine.env.PUBLIC_URL === undefined ? {} : { origin: engine.env.PUBLIC_URL });
			},
			storedSessions: () => {
				story.tell("read the session IP addresses stored in PostgreSQL");
				return Effect.flatMap(authTestDatabase, (storage) => storage.sessionIpAddresses);
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
	const { TRUSTED_PROXY: _proxy, ...env } = engine.env;
	engine.env = env;
});

function emailRequest(baseUrl: string, path: string, headers: Record<string, string>) {
	return emailResponse(baseUrl, path, headers).pipe(Effect.map((response) => response.status));
}

function emailResponse(baseUrl: string, path: string, headers: Record<string, string>) {
	return Effect.promise(
		() =>
			new Promise<{ status: number; cookies: readonly string[] }>((resolve, reject) => {
				const outgoing = request(
					`${baseUrl}/api/auth/${path}/email`,
					{
						headers: { "content-type": "application/json", origin: baseUrl, ...headers },
						localAddress: "127.0.0.1",
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
