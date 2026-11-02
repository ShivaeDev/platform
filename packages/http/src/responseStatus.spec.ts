import { DateTime, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { isRemoteStatusError, RemoteHttpError, RemoteNotFound } from "#errors.ts";
import { clockReadsTenSeconds, remoteAnswers } from "#test/http-client/answers.ts";
import { httpClient, usingClient } from "#test/http-client/story.ts";

for (const transport of ["fetch", "node"] as const) {
	for (const [status, errorType] of [
		[404, RemoteNotFound],
		[503, RemoteHttpError],
	] as const) {
		httpClient.it(
			`${transport} response and client checks return the same typed HTTP ${status} failure`,
			[usingClient(transport), remoteAnswers(status)],
			function* ({ checkResponse, remoteUrl }) {
				const direct = yield* checkResponse("response").pipe(Effect.flip);
				const filtered = yield* checkResponse("client").pipe(Effect.flip);

				expect(direct).toBeInstanceOf(errorType);
				expect(filtered).toBeInstanceOf(errorType);
				expect(isRemoteStatusError(direct)).toBe(true);
				expect(isRemoteStatusError(filtered)).toBe(true);
				const fields = { method: "POST", status, url: `${yield* remoteUrl()}/answer` };
				expect(direct).toMatchObject(fields);
				expect(filtered).toMatchObject(fields);
			},
		);
	}
	for (const mode of ["response", "client"] as const) {
		httpClient.it(
			`${transport} ${mode} check returns an HTTP 201 response with its body intact`,
			[usingClient(transport), remoteAnswers(HttpStatus.fromLiteral("Created"))],
			function* ({ checkResponse }) {
				const response = yield* checkResponse(mode);

				expect(response.status).toBe(HttpStatus.fromLiteral("Created"));
				expect(yield* response.json).toEqual({ item: "paper" });
				expect(isRemoteStatusError(response)).toBe(false);
			},
		);
		httpClient.it(
			`${transport} ${mode} check preserves the clock-based retry instant for HTTP 503`,
			[usingClient(transport), clockReadsTenSeconds, remoteAnswers(503, { "Retry-After": "120" })],
			function* ({ checkResponse }) {
				const error = yield* checkResponse(mode).pipe(Effect.flip);

				expect(isRemoteStatusError(error)).toBe(true);
				expect(error).toMatchObject({ _tag: "RemoteRateLimited", retryAfter: DateTime.makeUnsafe(130_000) });
			},
		);
	}
}
