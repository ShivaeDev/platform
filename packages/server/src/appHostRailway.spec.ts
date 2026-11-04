import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { clientIp, railway, untrustedPeer } from "#test/better-auth/clientIp.ts";

clientIp.it(
	"the Railway clientIp preset returns X-Real-IP in the session despite forged X-Forwarded-For and sends a secure cookie",
	[railway],
	function* ({ signUp, signInResponse, sessionIpAddress }) {
		yield* signUp();

		const response = yield* signInResponse({
			origin: "https://app.example",
			"x-forwarded-for": "198.51.100.99, 100.64.0.3",
			"x-real-ip": "203.0.113.10",
		});

		yield* outcomes([
			[
				"sign-in response",
				() => Effect.succeed(response),
				expect.objectContaining({
					cookies: expect.arrayContaining([expect.stringMatching(/^__Secure-better-auth\.session_token=.*; Secure(?:;|$)/u)]),
					status: HttpStatus.fromLiteral("OK"),
				}),
			],
			["session client IP", () => sessionIpAddress(response.cookies), "203.0.113.10"],
		]);
	},
);

for (const [scenario, traits, headers, address] of [
	["without X-Real-IP", [railway], { "x-forwarded-for": "198.51.100.99" }, "100.64.0.2"],
	["from an untrusted peer", [railway, untrustedPeer], { "x-forwarded-for": "198.51.100.99", "x-real-ip": "203.0.113.10" }, "203.0.113.5"],
] as const) {
	clientIp.it(
		`the Railway clientIp preset returns the peer address in the session ${scenario}`,
		traits,
		function* ({ signUp, signInResponse, sessionIpAddress }) {
			yield* signUp();

			const response = yield* signInResponse({ origin: "https://app.example", ...headers });

			expect(yield* sessionIpAddress(response.cookies)).toBe(address);
		},
	);
}

clientIp.it(
	"the Railway clientIp preset limits one X-Real-IP despite changing forged X-Forwarded-For",
	[railway],
	function* ({ signUp, signInResponse }) {
		yield* signUp();
		yield* signInResponse({ origin: "https://app.example", "x-forwarded-for": "198.51.100.1", "x-real-ip": "203.0.113.10" });
		yield* signInResponse({ origin: "https://app.example", "x-forwarded-for": "198.51.100.2", "x-real-ip": "203.0.113.10" });

		const response = yield* signInResponse({ origin: "https://app.example", "x-forwarded-for": "198.51.100.3", "x-real-ip": "203.0.113.10" });

		expect(response.status).toBe(HttpStatus.fromLiteral("TooManyRequests"));
	},
);

clientIp.it("Railway proxy trust accepts the forwarded HTTPS origin and refuses an HTTP or foreign origin", [railway], function* ({ rpcStatus }) {
	yield* outcomes([
		["foreign origin", () => rpcStatus("https://elsewhere.example"), HttpStatus.fromLiteral("Forbidden")],
		["HTTPS public origin", () => rpcStatus("https://app.example"), HttpStatus.fromLiteral("OK")],
		["wrong scheme", () => rpcStatus("http://app.example"), HttpStatus.fromLiteral("Forbidden")],
	]);
});
