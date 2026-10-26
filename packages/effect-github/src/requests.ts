import { DateTime, Effect } from "effect";
import type { HttpClient, HttpClientRequest } from "effect/http";
import { readBoundedBody } from "@shivaedev/platform/http-client/body.ts";
import { ResponseBodyTooLarge } from "@shivaedev/platform/http-client/errors.ts";
import { type CachedResponse, responseCache } from "#cache.ts";
import { GitHubTransportError } from "#errors.ts";
import type { GitHubToken } from "#GitHubToken.ts";
import { failRateLimited, type RateLimits } from "#rateLimits.ts";
import { checkStatus, isUnchanged } from "#status.ts";
import type { TokenRefresh } from "#TokenRefresh.ts";
import { tokenRequests } from "#tokenRequests.ts";

export function requests(
	client: HttpClient.HttpClient,
	token: GitHubToken["Service"],
	rates: RateLimits,
	refresh: typeof TokenRefresh.Service = undefined,
) {
	const cache = responseCache();
	const execute = tokenRequests(client, token, refresh);
	return Effect.fn("GitHub.request")(function* (input: HttpClientRequest.HttpClientRequest, limit: number) {
		const path = new URL(input.url).pathname;
		const resource = rates.resource(path);
		const blocked = rates.blocked.get(resource);
		if (blocked !== undefined && DateTime.isGreaterThan(blocked.retryAt, yield* DateTime.now)) {
			return yield* failRateLimited(path, blocked, rates.observations.get(resource)?.remaining);
		}
		const key = `${input.url} ${input.headers.accept}`;
		const cached = input.method === "GET" ? cache.get(key) : undefined;
		const response = yield* execute(input, cached).pipe(Effect.catchTag("HttpClientError", () => Effect.fail(new GitHubTransportError({ path }))));
		const observedResource = rates.observe(response);
		if (isUnchanged(response) && cached !== undefined) {
			rates.failures.delete(observedResource);
			rates.blocked.delete(observedResource);
			if (cached.bytes.byteLength > limit) {
				return yield* new ResponseBodyTooLarge({ limit });
			}
			return cached;
		}
		yield* checkStatus(response, observedResource, rates.failures.get(observedResource) ?? 0).pipe(
			Effect.catchTag("HttpClientError", () => Effect.fail(new GitHubTransportError({ path }))),
			Effect.catchTag("GitHubRateLimited", (error) => {
				rates.blocked.set(error.resource, error);
				rates.failures.set(error.resource, (rates.failures.get(error.resource) ?? 0) + 1);
				return failRateLimited(path, error, rates.observations.get(error.resource)?.remaining);
			}),
		);
		rates.failures.delete(observedResource);
		rates.blocked.delete(observedResource);
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
