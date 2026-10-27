import { DateTime, Effect } from "effect";
import { HttpClient, type HttpClientResponse } from "effect/http";
import { RemoteGone, RemoteHttpError, RemoteNotFound, RemoteRateLimited, type RemoteStatusError, RemoteUnauthorized } from "./errors.ts";
import { parseRetryAfter } from "./parseRetryAfter.ts";

const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const { status, request } = response;
	if (status >= 200 && status < 300) {
		return response;
	}
	const fields = { method: request.method, status, url: request.url.split(/[?#]/u)[0] ?? request.url };
	let error: RemoteStatusError;
	switch (status) {
		case 401:
			error = new RemoteUnauthorized(fields);
			break;
		case 404:
			error = new RemoteNotFound(fields);
			break;
		case 410:
			error = new RemoteGone(fields);
			break;
		default: {
			const header = response.headers["retry-after"];
			if (status === 429 || (status === 503 && header !== undefined)) {
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
