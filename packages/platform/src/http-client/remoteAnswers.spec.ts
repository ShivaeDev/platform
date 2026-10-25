import { DateTime, Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { httpClient, routeAnswers } from "#test/http-client/story.ts";
import { RemoteGone, RemoteHttpError, RemoteNotFound, RemoteRateLimited, RemoteUnauthorized } from "./errors.ts";

for (const [status, ErrorClass] of [
	[401, RemoteUnauthorized],
	[404, RemoteNotFound],
	[410, RemoteGone],
	[429, RemoteRateLimited],
	[418, RemoteHttpError],
	[302, RemoteHttpError],
	[503, RemoteHttpError],
] as const) {
	httpClient.it(`POST fails with ${ErrorClass.name} when the route answers ${status}`, [routeAnswers(status)], function* ({ answer, url }) {
		const error = yield* Effect.flip(answer());
		expect(error).toBeInstanceOf(ErrorClass);
		expect({ ...error }).toEqual({ _tag: ErrorClass.name, method: "POST", status, url: `${url()}/answer` });
	});
}

httpClient.it("a 2xx response passes through with its body and headers", [routeAnswers(201)], function* ({ answer }) {
	const response = yield* answer();
	expect({ status: response.status }).toEqual({ status: 201 });
	expect(response.headers["x-secret"]).toBe("remote-header");
	expect(yield* response.json).toEqual({ secret: "remote-body" });
});

httpClient.it("Retry-After delay-seconds use the TestClock instant", [routeAnswers(429, { "Retry-After": "120" })], function* ({ answer }) {
	yield* TestClock.adjust("10 seconds");
	const error = yield* Effect.flip(answer());
	expect(error).toBeInstanceOf(RemoteRateLimited);
	if (error instanceof RemoteRateLimited) {
		expect(error.retryAfter && DateTime.formatIso(error.retryAfter)).toBe("1970-01-01T00:02:10.000Z");
	}
});

httpClient.it(
	"a 503 with an HTTP-date Retry-After is rate limited until that UTC instant",
	[routeAnswers(503, { "Retry-After": "Sun, 25 Oct 2026 11:00:00 GMT" })],
	function* ({ answer }) {
		const error = yield* Effect.flip(answer());
		expect(error).toBeInstanceOf(RemoteRateLimited);
		if (error instanceof RemoteRateLimited) {
			expect(error.retryAfter && DateTime.formatIso(error.retryAfter)).toBe("2026-10-25T11:00:00.000Z");
		}
	},
);

httpClient.it(
	"an invalid Retry-After leaves rate limiting typed without a retry instant",
	[routeAnswers(429, { "Retry-After": "garbage" })],
	function* ({ answer }) {
		const error = yield* Effect.flip(answer());
		expect(error).toBeInstanceOf(RemoteRateLimited);
		if (error instanceof RemoteRateLimited) {
			expect(error.retryAfter).toBeUndefined();
		}
	},
);
