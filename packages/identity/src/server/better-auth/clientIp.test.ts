import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { clientIp, noProxy, proxyEnvironment } from "#test/better-auth/clientIp.ts";

const realIp = proxyEnvironment({ "AUTH_CLIENT_IP_HEADER": "x-real-ip" });
const untrustedPeer = proxyEnvironment({ "TRUSTED_PROXY": "127.0.0.2" });
const tooMany = HttpStatus.fromLiteral("TooManyRequests");

clientIp.it("Alice's session stores the X-Real-IP a trusted proxy sends", [realIp], function* ({ signIn, signUp, storedSessions }) {
	yield* signUp();

	yield* signIn({ "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10" });

	expect(yield* storedSessions()).toEqual([{ ipAddress: "203.0.113.10" }]);
});

clientIp.it(
	"with the default header, Alice's session stores the rightmost untrusted forwarded address",
	[],
	function* ({ signIn, signUp, storedSessions }) {
		yield* signUp();

		yield* signIn({ "x-forwarded-for": "198.51.100.99, 203.0.113.20, 127.0.0.1", "x-real-ip": "203.0.113.10" });

		expect(yield* storedSessions()).toEqual([{ ipAddress: "203.0.113.20" }]);
	},
);

for (const [header, traits] of [
	["the default header", [untrustedPeer]],
	["X-Real-IP", [untrustedPeer, realIp]],
] as const) {
	clientIp.it(
		`with ${header}, an untrusted peer's forged forwarding headers leave Alice's session with the peer address`,
		traits,
		function* ({ signIn, signUp, storedSessions }) {
			yield* signUp();

			yield* signIn({ "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10" });

			expect(yield* storedSessions()).toEqual([{ ipAddress: "127.0.0.1" }]);
		},
	);
}

clientIp.it("a third sign-in from one X-Real-IP is limited even with a new forged forwarding chain", [realIp], function* ({ signIn, signUp }) {
	yield* signUp();
	yield* signIn({ "x-forwarded-for": "198.51.100.1", "x-real-ip": "203.0.113.10" });
	yield* signIn({ "x-forwarded-for": "198.51.100.2", "x-real-ip": "203.0.113.10" });

	expect(yield* signIn({ "x-forwarded-for": "198.51.100.3", "x-real-ip": "203.0.113.10" })).toBe(tooMany);
});

clientIp.it("after one X-Real-IP reaches its sign-in limit, another X-Real-IP still signs in", [realIp], function* ({ signIn, signUp }) {
	yield* signUp();
	yield* signIn({ "x-real-ip": "203.0.113.10" });
	yield* signIn({ "x-real-ip": "203.0.113.10" });
	expect(yield* signIn({ "x-real-ip": "203.0.113.10" })).toBe(tooMany);

	const other = yield* signIn({ "x-real-ip": "203.0.113.20" });

	expect(other).toBe(HttpStatus.fromLiteral("OK"));
});

clientIp.it(
	"an untrusted peer's changing forged X-Real-IP values share that peer's sign-in limit",
	[realIp, untrustedPeer],
	function* ({ signIn, signUp }) {
		yield* signUp();
		yield* signIn({ "x-real-ip": "203.0.113.10" });
		yield* signIn({ "x-real-ip": "203.0.113.20" });

		expect(yield* signIn({ "x-real-ip": "203.0.113.30" })).toBe(tooMany);
	},
);

clientIp.it("without a proxy, one peer's changing forged headers share its sign-in limit", [noProxy], function* ({ signIn, signUp }) {
	yield* signUp();
	yield* signIn({ "x-forwarded-for": "198.51.100.10", "x-platform-client-ip": "198.51.100.10" });
	yield* signIn({ "x-forwarded-for": "198.51.100.20", "x-platform-client-ip": "198.51.100.20" });

	expect(yield* signIn({ "x-forwarded-for": "198.51.100.30" })).toBe(tooMany);
});

clientIp.it("without a proxy, a second peer has its own sign-in limit and stored address", [noProxy], function* ({ signIn, signUp, storedSessions }) {
	yield* signUp();
	yield* signIn({});
	yield* signIn({});
	expect(yield* signIn({})).toBe(tooMany);

	const status = yield* signIn({ "x-forwarded-for": "198.51.100.30" }, "127.0.0.2");

	yield* outcomes({
		"second peer's sign-in": [Effect.succeed(status), HttpStatus.fromLiteral("OK")],
		"stored addresses": [storedSessions(), expect.arrayContaining([{ ipAddress: "127.0.0.1" }, { ipAddress: "127.0.0.2" }])],
	});
});
