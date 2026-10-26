import { Effect, Option, Redacted } from "effect";
import { type HttpClient, type HttpClientError, HttpClientRequest } from "effect/http";
import type { GitHubToken } from "#GitHubToken.ts";
import { isUnauthorized } from "#status.ts";
import type { TokenRefresh } from "#TokenRefresh.ts";

export function tokenRequests<R>(
	client: HttpClient.HttpClient.With<HttpClientError.HttpClientError, R>,
	token: GitHubToken["Service"],
	refresh: typeof TokenRefresh.Service,
) {
	const accessToken = Effect.isEffect(token) ? token : Effect.succeed(token);
	return Effect.fnUntraced(function* (input: HttpClientRequest.HttpClientRequest) {
		const credential = yield* accessToken;
		let response = yield* client.execute(requestHeaders(input, credential));
		if (isUnauthorized(response) && refresh !== undefined) {
			yield* refresh(credential);
			response = yield* client.execute(requestHeaders(input, yield* accessToken));
		}
		return response;
	});
}

function requestHeaders(input: HttpClientRequest.HttpClientRequest, token: Option.Option<Redacted.Redacted<string>>) {
	let request = HttpClientRequest.setHeader(input, "X-GitHub-Api-Version", "2022-11-28");
	if (Option.isSome(token)) {
		request = HttpClientRequest.setHeader(request, "Authorization", `Bearer ${Redacted.value(token.value)}`);
	}
	return request;
}
