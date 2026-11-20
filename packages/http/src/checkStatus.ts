import { DateTime, Effect } from "effect";
import type { HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBodyExcerpt } from "#bodyExcerpt.ts";
import { RemoteGone, RemoteHttpError, RemoteNotFound, RemoteRateLimited, type RemoteStatusError, RemoteUnauthorized } from "#errors.ts";
import { parseRetryAfter } from "#parseRetryAfter.ts";

export const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const { status, request } = response;
	if (status >= HttpStatus.fromLiteral("OK") && status < HttpStatus.fromLiteral("MultipleChoices")) {
		return response;
	}
	const now = yield* DateTime.now;
	const bodyExcerpt = yield* readBodyExcerpt(response);
	const url = new URL(request.url);
	const fields = { method: request.method, status, url: `${url.origin}${url.pathname}`, ...(bodyExcerpt === undefined ? {} : { bodyExcerpt }) };
	let error: RemoteStatusError;
	switch (status) {
		case HttpStatus.fromLiteral("Unauthorized"):
			error = new RemoteUnauthorized(fields);
			break;
		case HttpStatus.fromLiteral("NotFound"):
			error = new RemoteNotFound(fields);
			break;
		case HttpStatus.fromLiteral("Gone"):
			error = new RemoteGone(fields);
			break;
		default: {
			const header = response.headers["retry-after"];
			if (status === HttpStatus.fromLiteral("TooManyRequests") || (status === HttpStatus.fromLiteral("ServiceUnavailable") && header !== undefined)) {
				const retryAfter = parseRetryAfter(header, now);
				error = new RemoteRateLimited({ ...fields, ...(retryAfter === undefined ? {} : { retryAfter }) });
			} else {
				error = new RemoteHttpError(fields);
			}
		}
	}
	return yield* Effect.fail(error);
});
