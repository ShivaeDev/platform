import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applicationRateLimit, applicationStorage, environment, memoryStorage, mount } from "#test/better-auth/mount.ts";

const TRACE_ID = "1234567890abcdef1234567890abcdef";

mount.it("while the provider fails, a visitor's auth request is answered as unavailable", [], function* ({ providerFails, request }) {
	expect(yield* request()).toBe("accepted");

	yield* providerFails();

	expect(yield* request()).toBe("unavailable");
});

mount.it("a provider failure is logged as an error inside the visitor's request trace", [], function* ({ errorLogs, providerFails, requestInTrace }) {
	yield* providerFails();

	yield* requestInTrace(TRACE_ID);

	expect(yield* errorLogs()).toEqual([{ message: "Authentication provider failed", traceId: TRACE_ID }]);
});

mount.it(
	"the logged provider failure keeps its message but redacts the token, password and cookie",
	[],
	function* ({ loggedFailure, logsMentionProviderSecrets, providerFails, request }) {
		yield* providerFails();

		yield* request();

		yield* outcomes({
			"logged failure": [
				loggedFailure(),
				{ cause: "password=<redacted>", cookie: "<redacted>", message: "Authentication provider is down: token=<redacted>" },
			],
			"secrets anywhere in the logs": [logsMentionProviderSecrets(), []],
		});
	},
);

const untrustedPeers = { "a different trusted proxy address": { "TRUSTED_PROXY": "127.0.0.2" }, "no trusted proxy": {} };
const trustedPeers = {
	"the peer as trusted proxy": { "TRUSTED_PROXY": "127.0.0.1" },
	"the peer's range as trusted proxy": { "TRUSTED_PROXY": "127.0.0.0/8" },
};

for (const header of ["x-forwarded-for", "x-real-ip"]) {
	for (const [peer, trust] of Object.entries(untrustedPeers)) {
		mount.it(
			`with ${header} as client IP header and ${peer}, auth sees the connecting peer and none of the forwarded headers`,
			[environment({ "AUTH_CLIENT_IP_HEADER": header, ...trust })],
			function* ({ clientAuthSaw, forwardedHeadersAuthSaw, request }) {
				yield* request("alice");

				yield* outcomes({
					"client auth saw": [clientAuthSaw(), "the connecting peer"],
					"forwarded headers auth saw": [forwardedHeadersAuthSaw(), []],
				});
			},
		);
	}
	for (const [peer, trust] of Object.entries(trustedPeers)) {
		mount.it(
			`with ${header} as client IP header and ${peer}, auth sees alice and the forwarded headers`,
			[environment({ "AUTH_CLIENT_IP_HEADER": header, ...trust })],
			function* ({ clientAuthSaw, forwardedHeadersAuthSaw, request }) {
				yield* request("alice");

				yield* outcomes({
					"client auth saw": [clientAuthSaw(), "alice"],
					"forwarded headers auth saw": [forwardedHeadersAuthSaw(), [...new Set(["x-forwarded-for", header])]],
				});
			},
		);
	}
}

mount.it(
	"even when the app's own options switch rate limiting off, a third auth request within a minute is rate limited",
	[applicationRateLimit(false)],
	function* ({ request, useAllowance }) {
		expect(yield* useAllowance()).toEqual(["accepted", "accepted"]);

		expect(yield* request()).toBe("rate limited");
	},
);

mount.it(
	"AUTH_RATE_LIMIT_ENABLED=false lets a third auth request within a minute through even when the app's options enable rate limiting",
	[applicationRateLimit(true), environment({ "AUTH_RATE_LIMIT_ENABLED": "false" })],
	function* ({ request, useAllowance }) {
		expect(yield* useAllowance()).toEqual(["accepted", "accepted"]);

		expect(yield* request()).toBe("accepted");
	},
);

for (const header of ["x-forwarded-for", "x-real-ip"]) {
	mount.it(
		`behind a trusted proxy that names clients in ${header}, alice using up her allowance leaves bob's requests accepted`,
		[environment({ "AUTH_CLIENT_IP_HEADER": header, "TRUSTED_PROXY": "127.0.0.1" })],
		function* ({ request, useAllowance }) {
			expect(yield* useAllowance("alice")).toEqual(["accepted", "accepted"]);

			yield* outcomes({
				alice: [request("alice"), "rate limited"],
				bob: [request("bob"), "accepted"],
			});
		},
	);
}

for (const [storage, traits] of Object.entries({ "default storage": [], "explicit memory storage": [memoryStorage] })) {
	mount.it(
		`with ${storage}, a second auth host in the same process starts with its own rate-limit buckets`,
		traits,
		function* ({ request, requestSecondHost, startSecondHost, useAllowance }) {
			expect(yield* useAllowance()).toEqual(["accepted", "accepted"]);

			yield* startSecondHost();

			yield* outcomes({
				"first host": [request(), "rate limited"],
				"second host": [requestSecondHost(), "accepted"],
			});
		},
	);
}

mount.it(
	"the app's own rate-limit storage decides every auth request, asked with the app's rule for one client",
	[applicationStorage],
	function* ({ lastAnswer, request, storageCalls, useAllowance }) {
		yield* useAllowance();

		yield* request();

		yield* outcomes({
			"storage calls": [
				storageCalls(),
				{
					clients: 1,
					rules: [
						{ max: 2, window: 60 },
						{ max: 2, window: 60 },
						{ max: 2, window: 60 },
					],
				},
			],
			"third request": [lastAnswer(), "accepted"],
		});
	},
);
