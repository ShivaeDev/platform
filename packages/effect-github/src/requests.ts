import { DateTime, Effect, Option, Redacted } from "effect";
import { type HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedBody } from "@shivaedev/platform/http-client/body.ts";
import { ResponseBodyTooLarge } from "@shivaedev/platform/http-client/errors.ts";
import { type CachedResponse, responseCache } from "./cache.ts";
import { GitHubTransportError } from "./errors.ts";
import { failRateLimited, type RateLimits } from "./rateLimits.ts";
import { checkStatus, isUnchanged } from "./status.ts";

export function requests(client: HttpClient.HttpClient, token: Option.Option<Redacted.Redacted<string>>, rates: RateLimits) {
	const cache = responseCache();
	return Effect.fn("GitHub.request")(function* (input: HttpClientRequest.HttpClientRequest, limit: number) {
		const path = new URL(input.url).pathname;
		const resource = rates.resource(path);
		const blocked = rates.blocked.get(resource);
		if (blocked !== undefined && DateTime.isGreaterThan(blocked.retryAt, yield* DateTime.now)) {
			return yield* failRateLimited(path, blocked, rates.observations.get(resource)?.remaining);
		}
		const key = `${input.url} ${input.headers.accept}`;
		const cached = input.method === "GET" ? cache.get(key) : undefined;
		const request = requestHeaders(input, cached, token);
		const response = yield* client.execute(request).pipe(Effect.mapError(() => new GitHubTransportError({ path })));
		const observedResource = rates.observe(response);
		if (isUnchanged(response) && cached !== undefined) {
			if (cached.bytes.byteLength > limit) {
				return yield* new ResponseBodyTooLarge({ limit });
			}
			return cached;
		}
		yield* checkStatus(response, observedResource).pipe(
			Effect.catchTag("HttpClientError", () => Effect.fail(new GitHubTransportError({ path }))),
			Effect.catchTag("GitHubRateLimited", (error) => {
				rates.blocked.set(error.resource, error);
				return failRateLimited(path, error, rates.observations.get(error.resource)?.remaining);
			}),
		);
		const bytes = yield* readBoundedBody(response, limit).pipe(
			Effect.catchTag("HttpClientError", () => Effect.fail(new GitHubTransportError({ path }))),
		);
		const entry: CachedResponse = { bytes, decoded: new Map(), response };
		if (input.method === "GET" && response.headers.etag !== undefined) {
			cache.set(key, entry);
		}
		return entry;
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
