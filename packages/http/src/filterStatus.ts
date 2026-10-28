import { DateTime, Effect } from "effect";
import { HttpClient, type HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { RemoteGone, RemoteHttpError, RemoteNotFound, RemoteRateLimited, type RemoteStatusError, RemoteUnauthorized } from "./errors.ts";
import { parseRetryAfter } from "./parseRetryAfter.ts";

const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const { status, request } = response;
	if (status >= HttpStatus.fromLiteral("OK") && status < HttpStatus.fromLiteral("MultipleChoices")) {
		return response;
	}
	const fields = { method: request.method, status, url: request.url.split(/[?#]/u)[0] ?? request.url };
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
				const retryAfter = parseRetryAfter(header, yield* DateTime.now);
				error = new RemoteRateLimited({ ...fields, ...(retryAfter === undefined ? {} : { retryAfter }) });
			} else {
				error = new RemoteHttpError(fields);
			}
		}
	}
	return yield* Effect.fail(error);
});

export function filterStatus<E, R>(client: HttpClient.HttpClient.With<E, R>): HttpClient.HttpClient.With<E | RemoteStatusError, R> {
	return HttpClient.transformResponse(client, Effect.flatMap(checkStatus));
}
