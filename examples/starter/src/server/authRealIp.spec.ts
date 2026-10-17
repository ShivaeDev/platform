import { expect } from "vitest";
import { app, behindProxy } from "#test-support/application.ts";

const realIp = behindProxy({ authClientIpHeader: "x-real-ip", trustedProxy: "127.0.0.1" });

app.it("isolates sign-in limits by X-Real-IP from a trusted peer", [realIp], function* ({ authRateLimits }) {
	const proxy = authRateLimits().visitor("127.0.0.1");
	for (let attempt = 0; attempt < 3; attempt += 1) {
		expect(yield* proxy.signIn("198.51.100.1", "203.0.113.10")).toBe(401);
	}
	expect(yield* proxy.signIn("198.51.100.1", "203.0.113.10")).toBe(429);
	expect(yield* proxy.signIn("198.51.100.1", "203.0.113.20")).toBe(401);
});

app.it("shares a sign-in bucket for the same X-Real-IP across changing forwarding chains", [realIp], function* ({ authRateLimits }) {
	const proxy = authRateLimits().visitor("127.0.0.1");
	for (let attempt = 0; attempt < 3; attempt += 1) {
		expect(yield* proxy.signIn(`198.51.100.${attempt + 1}`, "203.0.113.10")).toBe(401);
	}
	expect(yield* proxy.signIn("198.51.100.4", "203.0.113.10")).toBe(429);
	expect(yield* proxy.signIn(undefined, "203.0.113.10")).toBe(429);
});

for (const trustedProxy of [undefined, "127.0.0.2"]) {
	app.it(
		`ignores X-Real-IP when proxy trust is ${trustedProxy ?? "unset"}`,
		[behindProxy({ authClientIpHeader: "x-real-ip", trustedProxy })],
		function* ({ authRateLimits }) {
			const peer = authRateLimits().visitor("127.0.0.1");
			for (let attempt = 0; attempt < 3; attempt += 1) {
				expect(yield* peer.signIn(undefined, `203.0.113.${attempt + 1}`)).toBe(401);
			}
			expect(yield* peer.signIn(undefined, "203.0.113.4")).toBe(429);
		},
	);
}
