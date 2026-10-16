import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { credentials, notesHttp } from "#test-support/authHttp.ts";
import { forwardingProxy } from "#test-support/forwardingProxy.ts";
import { effectApp } from "#test-support/postgres.ts";
import { starterHost } from "./starterHost.ts";

const PUBLIC_URL = "https://app.example";

effectApp("authenticates and serves protected RPC behind an HTTPS forwarding proxy using environment settings", function* () {
	const database = yield* PostgresTestDatabase;
	const context = yield* Layer.build(
		starterHost({ databaseUrl: database.url, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }).pipe(
			Layer.provide(
				ConfigProvider.layer(
					ConfigProvider.fromEnv({ env: { "HOST": "0.0.0.0", "PORT": "0", "PUBLIC_URL": PUBLIC_URL, "TRUSTED_PROXY": "127.0.0.1" } }),
				),
			),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP server");
	}
	const upstream = `http://127.0.0.1:${server.address.port}`;
	const proxy = yield* Effect.acquireRelease(
		Effect.promise(() => forwardingProxy(upstream)),
		(fixture) => Effect.promise(() => fixture.close()),
	);
	for (const path of ["sign-up/email", "sign-in/email"]) {
		const response = yield* Effect.promise(() =>
			fetch(`${proxy.url}/api/auth/${path}`, {
				body: JSON.stringify(credentials("deployed")),
				headers: { "content-type": "application/json", origin: PUBLIC_URL },
				method: "POST",
			}),
		);
		expect(response.status).toBe(200);
		yield* Effect.promise(() => response.text());
		const cookies = response.headers.getSetCookie();
		expect(cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && /; Secure(?:;|$)/iv.test(value))).toBe(true);
		const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
		const client = yield* notesHttp(proxy.url, cookie, PUBLIC_URL);
		expect(yield* client["notes.list"]()).toEqual([]);
		const refused = yield* Effect.promise(() =>
			fetch(`${proxy.url}/rpc`, {
				body: "[]",
				headers: { "content-type": "application/ndjson", cookie, origin: "https://foreign.example" },
				method: "POST",
			}),
		);
		expect(refused.status).toBe(403);
		yield* Effect.promise(() => refused.text());
	}
});
