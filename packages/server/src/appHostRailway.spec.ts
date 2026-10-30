import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { clientIp, railway } from "#test/better-auth/clientIp.ts";

clientIp.it(
	"the starter's Railway trust stores the forwarded client IP and sends a secure session cookie",
	[railway],
	function* ({ signUp, signInResponse, storedSessions }) {
		yield* signUp();

		const response = yield* signInResponse({
			origin: "https://app.example",
			"x-forwarded-for": "198.51.100.99, 100.64.0.3",
			"x-real-ip": "203.0.113.10",
		});

		yield* outcomes({
			"sign-in response": [
				Effect.succeed(response),
				expect.objectContaining({
					cookies: expect.arrayContaining([expect.stringMatching(/^__Secure-better-auth\.session_token=.*; Secure(?:;|$)/u)]),
					status: HttpStatus.fromLiteral("OK"),
				}),
			],
			"stored client IP": [storedSessions(), [{ ipAddress: "203.0.113.10" }]],
		});
	},
);

clientIp.it(
	"the starter's Railway trust accepts the forwarded HTTPS origin and refuses an HTTP or foreign origin",
	[railway],
	function* ({ rpcStatus }) {
		yield* outcomes({
			"foreign origin": [rpcStatus("https://elsewhere.example"), HttpStatus.fromLiteral("Forbidden")],
			"HTTPS public origin": [rpcStatus("https://app.example"), HttpStatus.fromLiteral("OK")],
			"wrong scheme": [rpcStatus("http://app.example"), HttpStatus.fromLiteral("Forbidden")],
		});
	},
);
