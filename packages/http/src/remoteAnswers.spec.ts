import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { clockReadsTenSeconds, httpClient, remoteAnswers } from "#test/http-client/story.ts";

for (const [status, outcome] of [
	[HttpStatus.fromLiteral("Unauthorized"), "unauthorized"],
	[HttpStatus.fromLiteral("NotFound"), "not found"],
	[HttpStatus.fromLiteral("Gone"), "gone"],
	[HttpStatus.fromLiteral("TooManyRequests"), "rate limited"],
	[HttpStatus.fromLiteral("ImATeapot"), "HTTP 418"],
	[HttpStatus.fromLiteral("Found"), "HTTP 302"],
	[HttpStatus.fromLiteral("ServiceUnavailable"), "HTTP 503"],
] as const) {
	httpClient.it(`a POST the remote answers with HTTP ${status} fails as ${outcome}`, [remoteAnswers(status)], function* ({ post }) {
		expect(yield* post()).toBe(outcome);
	});
}

httpClient.it(
	"a refused POST to /answer?token=private names POST /answer without the query",
	[remoteAnswers(HttpStatus.fromLiteral("Unauthorized"))],
	function* ({ post, refusedRequest }) {
		yield* post();

		expect(yield* refusedRequest()).toBe("POST /answer");
	},
);

httpClient.it(
	"a POST the remote answers with HTTP 201 returns its status, header and body",
	[remoteAnswers(HttpStatus.fromLiteral("Created"))],
	function* ({ post }) {
		expect(yield* post()).toEqual({ body: { item: "paper" }, requestId: "remote-1", status: HttpStatus.fromLiteral("Created") });
	},
);

httpClient.it(
	"at 00:00:10, a 429 with Retry-After: 120 fails as rate limited until 00:02:10 on the Effect clock",
	[clockReadsTenSeconds, remoteAnswers(HttpStatus.fromLiteral("TooManyRequests"), { "Retry-After": "120" })],
	function* ({ post }) {
		expect(yield* post()).toBe("rate limited until 1970-01-01 00:02:10 UTC");
	},
);

httpClient.it(
	"a 503 with Retry-After: Sun, 25 Oct 2026 11:00:00 GMT fails as rate limited until that UTC instant",
	[remoteAnswers(HttpStatus.fromLiteral("ServiceUnavailable"), { "Retry-After": "Sun, 25 Oct 2026 11:00:00 GMT" })],
	function* ({ post }) {
		expect(yield* post()).toBe("rate limited until 2026-10-25 11:00:00 UTC");
	},
);

httpClient.it(
	"a 429 with Retry-After: garbage fails as rate limited without a retry instant",
	[remoteAnswers(HttpStatus.fromLiteral("TooManyRequests"), { "Retry-After": "garbage" })],
	function* ({ post }) {
		expect(yield* post()).toBe("rate limited");
	},
);
