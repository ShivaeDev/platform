import { expect } from "vitest";
import { clientIp, proxyEnvironment } from "#test/better-auth/clientIp.ts";

const realIp = proxyEnvironment({ "AUTH_CLIENT_IP_HEADER": "x-real-ip" });
const untrustedPeer = proxyEnvironment({ "TRUSTED_PROXY": "127.0.0.2" });

clientIp.it("a trusted proxy's X-Real-IP reaches the stored email session", [realIp], function* ({ signUp, signIn, storedSessions }) {
	let status = yield* signUp();
	expect(status).toBe(200);
	status = yield* signIn({ "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10" });
	expect(status).toBe(200);
	expect(yield* storedSessions()).toEqual([{ ipAddress: "203.0.113.10" }]);
});

clientIp.it("the default header stores the rightmost untrusted forwarded address", [], function* ({ signUp, signIn, storedSessions }) {
	let status = yield* signUp();
	expect(status).toBe(200);
	status = yield* signIn({ "x-forwarded-for": "198.51.100.99, 203.0.113.20, 127.0.0.1", "x-real-ip": "203.0.113.10" });
	expect(status).toBe(200);
	expect(yield* storedSessions()).toEqual([{ ipAddress: "203.0.113.20" }]);
});

for (const header of [[], [realIp]]) {
	clientIp.it(
		`an untrusted peer cannot put either forged header into a session (${header.length === 0 ? "default" : "x-real-ip"})`,
		[untrustedPeer, ...header],
		function* ({ signUp, signIn, storedSessions }) {
			let status = yield* signUp();
			expect(status).toBe(200);
			status = yield* signIn({ "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10" });
			expect(status).toBe(200);
			const sessions = yield* storedSessions();
			expect(sessions).toEqual([{ ipAddress: expect.toBeOneOf([null, expect.any(String)]) }]);
			expect(sessions[0]?.ipAddress).not.toBe("198.51.100.99");
			expect(sessions[0]?.ipAddress).not.toBe("203.0.113.10");
		},
	);
}

clientIp.it("sign-in limits follow X-Real-IP despite changing forged forwarding chains", [realIp], function* ({ signUp, signIn }) {
	let status = yield* signUp();
	expect(status).toBe(200);
	status = yield* signIn({ "x-forwarded-for": "198.51.100.1", "x-real-ip": "203.0.113.10" });
	expect(status).toBe(200);
	status = yield* signIn({ "x-forwarded-for": "198.51.100.2", "x-real-ip": "203.0.113.10" });
	expect(status).toBe(200);
	status = yield* signIn({ "x-forwarded-for": "198.51.100.3", "x-real-ip": "203.0.113.10" });
	expect(status).toBe(429);
	status = yield* signIn({ "x-forwarded-for": "198.51.100.3", "x-real-ip": "203.0.113.20" });
	expect(status).toBe(200);
});

clientIp.it("an untrusted peer's forged X-Real-IP values share the sign-in path limit", [realIp, untrustedPeer], function* ({ signUp, signIn }) {
	let status = yield* signUp();
	expect(status).toBe(200);
	status = yield* signIn({ "x-real-ip": "203.0.113.10" });
	expect(status).toBe(200);
	status = yield* signIn({ "x-real-ip": "203.0.113.20" });
	expect(status).toBe(200);
	status = yield* signIn({ "x-real-ip": "203.0.113.30" });
	expect(status).toBe(429);
});
