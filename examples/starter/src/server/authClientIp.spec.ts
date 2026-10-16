import { Effect } from "effect";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { credentials } from "#test-support/authHttp.ts";
import { forwardingProxy } from "#test-support/forwardingProxy.ts";
import { effectMigration } from "#test-support/postgres.ts";
import { productionAuth } from "#test-support/productionAuth.ts";

function proxy(upstream: string, clientIp: string) {
	return Effect.acquireRelease(
		Effect.promise(() => forwardingProxy(upstream, clientIp)),
		(fixture) => Effect.promise(() => fixture.close()),
	);
}
function signIn(url: string) {
	return Effect.promise(async () => {
		const response = await fetch(`${url}/api/auth/sign-in/email`, {
			body: JSON.stringify(credentials("unknown")),
			headers: { "content-type": "application/json", origin: "https://app.example" },
			method: "POST",
		});
		await response.text();
		return response.status;
	});
}

for (const trustedProxy of ["127.0.0.1", " 192.0.2.1, 127.0.0.0/8, 2001:db8::/32 "]) {
	effectMigration(`isolates production sign-in limits through a trusted proxy (${trustedProxy}) without an IP warning`, function* () {
		const database = yield* PostgresTestDatabase;
		const host = yield* productionAuth(database.url, trustedProxy);
		const alice = yield* proxy(host.url, "198.51.100.10, 127.0.0.1");
		const bob = yield* proxy(host.url, "198.51.100.20, 127.0.0.1");
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect(yield* signIn(alice.url)).toBe(401);
		}
		expect(yield* signIn(alice.url)).toBe(429);
		expect(yield* signIn(bob.url)).toBe(401);
		expect(host.output()).not.toContain("could not determine a client IP");
	});
}
for (const trustedProxy of [undefined, "127.0.0.2"]) {
	effectMigration(`ignores forwarded client IPs when proxy trust is ${trustedProxy ?? "unset"}`, function* () {
		const database = yield* PostgresTestDatabase;
		const host = yield* productionAuth(database.url, trustedProxy);
		const alice = yield* proxy(host.url, "198.51.100.10");
		const bob = yield* proxy(host.url, "198.51.100.20");
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect(yield* signIn(alice.url)).toBe(401);
		}
		expect(yield* signIn(bob.url)).toBe(429);
		expect(host.output()).toContain("could not determine a client IP");
	});
}
