import { Effect, Stream } from "effect";
import { type HttpClient, HttpClientRequest, type HttpClientResponse } from "effect/http";
import { PaginationLinkError } from "./errors.ts";
import { nextLink } from "./nextLink.ts";

const nextRequest = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const link = nextLink(response.headers.link);
	if (link === undefined) {
		return undefined;
	}
	const current = response.url || response.request.url;
	const url = current.split(/[?#]/u)[0] ?? current;
	const next = yield* Effect.try({
		catch: () => new PaginationLinkError({ reason: "invalid", url }),
		try: () => new URL(link, current),
	});
	if (next.origin !== new URL(current).origin) {
		return yield* new PaginationLinkError({ reason: "cross-origin", url });
	}
	return HttpClientRequest.setUrl(response.request, next);
});

export function paginate<E, R>(client: HttpClient.HttpClient.With<E, R>, first: HttpClientRequest.HttpClientRequest) {
	return Stream.unfold<
		HttpClientRequest.HttpClientRequest | HttpClientResponse.HttpClientResponse,
		HttpClientResponse.HttpClientResponse,
		E | PaginationLinkError,
		R
	>(first, (state) =>
		Effect.gen(function* () {
			const request = HttpClientRequest.isHttpClientRequest(state) ? state : yield* nextRequest(state);
			if (request === undefined) {
				return undefined;
			}
			const response = yield* client.execute(request);
			return [response, response] as const;
		}),
	);
}
