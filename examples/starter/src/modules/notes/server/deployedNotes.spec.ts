import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, behindProxy } from "#modules/notes/test-support/application.ts";

app.it(
	"authenticates and serves protected RPC behind an HTTPS forwarding proxy using environment settings",
	[behindProxy()],
	function* ({ authenticateResponse, notes, foreignRequest }) {
		const result = yield* authenticateResponse("deployed", "sign-up/email");
		expect(result.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(result.cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && /; Secure(?:;|$)/iv.test(value))).toBe(true);
		const cookie = result.cookie;
		const client = yield* notes(cookie);
		yield* outcomes({
			"foreign origin response": [
				Effect.gen(function* () {
					return (yield* foreignRequest(cookie)).status;
				}),
				HttpStatus.fromLiteral("Forbidden"),
			],
			"protected notes": [client.list(), []],
		});
	},
);
