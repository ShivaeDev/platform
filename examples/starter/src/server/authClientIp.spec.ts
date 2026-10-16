import { expect } from "vitest";
import { app } from "#test-support/application.ts";

for (const trustedProxy of ["127.0.0.1", " 192.0.2.1, 127.0.0.0/8, 2001:db8::/32 "]) {
	app.it(`isolates production sign-in limits through a trusted proxy (${trustedProxy}) without an IP warning`, [], function* ({ authRateLimits }) {
		const limits = yield* authRateLimits(trustedProxy);
		const alice = yield* limits.visitor("198.51.100.10, 127.0.0.1");
		const bob = yield* limits.visitor("198.51.100.20, 127.0.0.1");
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect(yield* alice.signIn()).toBe(401);
		}
		expect(yield* alice.signIn()).toBe(429);
		expect(yield* bob.signIn()).toBe(401);
		expect(limits.output()).not.toContain("could not determine a client IP");
	});
}
for (const trustedProxy of [undefined, "127.0.0.2"]) {
	app.it(`ignores forwarded client IPs when proxy trust is ${trustedProxy ?? "unset"}`, [], function* ({ authRateLimits }) {
		const limits = yield* authRateLimits(trustedProxy);
		const alice = yield* limits.visitor("198.51.100.10");
		const bob = yield* limits.visitor("198.51.100.20");
		for (let attempt = 0; attempt < 3; attempt += 1) {
			expect(yield* alice.signIn()).toBe(401);
		}
		expect(yield* bob.signIn()).toBe(429);
		expect(limits.output()).toContain("could not determine a client IP");
	});
}
