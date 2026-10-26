import { Effect, Option, Redacted } from "effect";
import { type HttpClient, HttpClientRequest } from "effect/http";
import type { CachedResponse } from "#cache.ts";
import type { GitHubToken } from "#GitHubToken.ts";
import { isUnauthorized } from "#status.ts";
import type { TokenRefresh } from "#TokenRefresh.ts";

export function tokenRequests(client: HttpClient.HttpClient, token: GitHubToken["Service"], refresh: typeof TokenRefresh.Service) {
	const accessToken = Effect.isEffect(token) ? token : Effect.succeed(token);
	return Effect.fnUntraced(function* (input: HttpClientRequest.HttpClientRequest, cached: CachedResponse | undefined) {
		const credential = yield* accessToken;
		let response = yield* client.execute(requestHeaders(input, cached, credential));
		if (isUnauthorized(response) && refresh !== undefined) {
			yield* refresh(credential);
			response = yield* client.execute(requestHeaders(input, cached, yield* accessToken));
		}
		return response;
	});
}

function requestHeaders(
	input: HttpClientRequest.HttpClientRequest,
	cached: CachedResponse | undefined,
	token: Option.Option<Redacted.Redacted<string>>,
) {
	let request = HttpClientRequest.removeHeader(input, "if-none-match").pipe(HttpClientRequest.setHeader("X-GitHub-Api-Version", "2022-11-28"));
	if (Option.isSome(token)) {
		request = HttpClientRequest.setHeader(request, "Authorization", `Bearer ${Redacted.value(token.value)}`);
	}
	if (cached?.response.headers.etag !== undefined) {
		request = HttpClientRequest.setHeader(request, "If-None-Match", cached.response.headers.etag);
	}
	return request;
}
