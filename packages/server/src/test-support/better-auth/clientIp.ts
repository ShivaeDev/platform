import { Effect, Schema } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { post } from "#test/app-host/fixture.ts";
import { clientIpHost } from "#test/better-auth/clientIpHost.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

interface Engine {
	readonly env: Record<string, string>;
	host?: Effect.Success<ReturnType<typeof clientIpHost>>;
	proxyPeer?: string;
}

export const clientIp = storyKit({
	after: {
		*configured(engine) {
			engine.host = yield* clientIpHost(engine.env, engine.proxyPeer);
		},
	},
	around: withIsolatedDatabase,
	clock: "test",
	create: (): Engine => ({ env: { "TRUSTED_PROXY": "127.0.0.1" } }),
	inspect: (engine) => ({ env: engine.env, url: engine.host?.baseUrl }),
	layer: postgres,
	name: "auth client IP through appHost",
	runIf: databaseUrl !== undefined,
	stages: ["configured"],
	verbs: (engine, story) => {
		const host = engine.host;
		if (host === undefined) {
			throw new Error("The client IP story host has not started");
		}
		const { baseUrl } = host;

		return {
			rpcStatus: (origin: string) => {
				story.tell(`RPC arrives with Origin ${origin} through Railway's HTTPS proxy`);
				return Effect.promise(() =>
					post(baseUrl, {
						host: "internal.test",
						origin,
						"x-forwarded-host": "app.example",
						"x-forwarded-proto": "https",
					}),
				);
			},
			sessionIpAddress: (cookies: readonly string[]) => {
				story.tell("read Alice's session IP address over HTTP");
				return Effect.promise(async () => {
					const response = await fetch(`${baseUrl}/api/auth/get-session`, {
						headers: { cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; ") },
					});
					const body = Schema.decodeUnknownSync(Schema.Struct({ session: Schema.Struct({ ipAddress: Schema.String }) }))(await response.json());
					return body.session.ipAddress;
				});
			},
			signInResponse: (headers: Record<string, string>) => {
				story.tell("Alice signs in through Railway's proxy");
				return emailResponse(baseUrl, "sign-in", headers);
			},
			signUp: () => {
				story.tell("Alice registers an email and password over HTTP without signing in");
				return emailRequest(baseUrl, "sign-up", engine.env.PUBLIC_URL === undefined ? {} : { origin: engine.env.PUBLIC_URL });
			},
		};
	},
});

export const railway = clientIp.trait("configured", "Railway proxy settings with a simulated transport peer", (engine) => {
	Object.assign(engine.env, {
		"AUTH_CLIENT_IP_HEADER": "x-forwarded-for",
		"HOST": "0.0.0.0",
		"PUBLIC_URL": "https://app.example",
		"TRUSTED_PROXY": "100.64.0.0/10",
	});
	engine.proxyPeer = "100.64.0.2";
});

export const untrustedPeer = clientIp.trait("configured", "the transport peer is outside Railway's trusted proxy range", (engine) => {
	engine.proxyPeer = "203.0.113.5";
});

function emailRequest(baseUrl: string, path: string, headers: Record<string, string>) {
	return emailResponse(baseUrl, path, headers).pipe(Effect.map((response) => response.status));
}

function emailResponse(baseUrl: string, path: string, headers: Record<string, string>) {
	return Effect.promise(async () => {
		const response = await fetch(`${baseUrl}/api/auth/${path}/email`, {
			body: JSON.stringify({ email: "alice@example.test", name: "Alice", password: "story-password-123" }),
			headers: { "content-type": "application/json", origin: baseUrl, ...headers },
			method: "POST",
		});
		await response.text();
		return { cookies: response.headers.getSetCookie(), status: response.status };
	});
}
