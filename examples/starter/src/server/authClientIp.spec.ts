import { expect } from "vitest";
import { app, authRateLimiting, behindProxy } from "#test-support/application.ts";

for (const trustedProxy of ["127.0.0.1", " 192.0.2.1, 127.0.0.0/8, 2001:db8::/32 ", "::ffff:127.0.0.0/104", "::ffff:7f00:0/104"]) {
	app.it(
		`isolates sign-in limits across appended forwarding chains (${trustedProxy})`,
		[behindProxy({ trustedProxy })],
		function* ({ authRateLimits }) {
			const limits = authRateLimits();
			const alice = limits.visitor("::1");
			const bob = limits.visitor("127.0.0.1");
			for (let attempt = 0; attempt < 3; attempt += 1) {
				expect(yield* alice.signIn("198.51.100.10")).toBe(401);
			}
			expect(yield* alice.signIn("198.51.100.10")).toBe(429);
			expect(yield* bob.signIn("198.51.100.20")).toBe(401);
		},
	);
}
for (const trustedProxy of [undefined, "127.0.0.2", "::ffff:126.0.0.0/104"]) {
	app.it(
		`ignores forwarded client IPs when proxy trust is ${trustedProxy ?? "unset"}`,
		[behindProxy({ trustedProxy })],
		function* ({ authRateLimits }) {
			const limits = authRateLimits();
			const alice = limits.visitor("::1");
			const bob = limits.visitor("127.0.0.1");
			for (let attempt = 0; attempt < 3; attempt += 1) {
				expect(yield* alice.signIn()).toBe(401);
			}
			expect(yield* bob.signIn()).toBe(429);
		},
	);
}

app.it("enables sign-in limits through app configuration", [behindProxy(), authRateLimiting(true)], function* ({ authRateLimits }) {
	const limits = authRateLimits();
	const alice = limits.visitor("::1");
	for (let attempt = 0; attempt < 3; attempt += 1) {
		expect(yield* alice.signIn()).toBe(401);
	}
	expect(yield* alice.signIn()).toBe(429);
});

for (const trustedProxy of [undefined, "127.0.0.1"]) {
	app.it(
		`disables sign-in limits with proxy trust ${trustedProxy ?? "unset"}`,
		[behindProxy({ trustedProxy }), authRateLimiting(false)],
		function* ({ authRateLimits }) {
			const limits = authRateLimits();
			const alice = limits.visitor("::1");
			const bob = limits.visitor("127.0.0.1");
			for (let attempt = 0; attempt < 4; attempt += 1) {
				expect(yield* alice.signIn()).toBe(401);
			}
			expect(yield* bob.signIn()).toBe(401);
		},
	);
}

app.it("keeps the same sign-in bucket when a visitor forges forwarding headers", [behindProxy()], function* ({ authRateLimits }) {
	const limits = authRateLimits();
	const alice = limits.visitor("::1");
	const bob = limits.visitor("127.0.0.1");
	for (let attempt = 0; attempt < 3; attempt += 1) {
		expect(yield* alice.signIn("198.51.100.10")).toBe(401);
	}
	expect(yield* alice.signIn("198.51.100.20")).toBe(429);
	expect(yield* alice.signIn()).toBe(429);
	expect(yield* bob.signIn("198.51.100.10")).toBe(401);
});
