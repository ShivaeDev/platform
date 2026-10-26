import { DateTime, Effect } from "effect";
import { FetchHttpClient, type HttpClient, type HttpClientError, type HttpClientRequest } from "effect/http";
import { GitHubTransportError } from "#errors.ts";
import type { GitHubToken } from "#GitHubToken.ts";
import { failRateLimited, type RateLimits } from "#rateLimits.ts";
import { checkStatus, isUnchanged } from "#status.ts";
import type { TokenRefresh } from "#TokenRefresh.ts";
import { tokenRequests } from "#tokenRequests.ts";

export function authenticatedRequest<R>(
	client: HttpClient.HttpClient.With<HttpClientError.HttpClientError, R>,
	token: GitHubToken["Service"],
	rates: RateLimits,
	refresh: typeof TokenRefresh.Service = undefined,
) {
	const send = tokenRequests(client, token, refresh);
	return Effect.fnUntraced(function* (input: HttpClientRequest.HttpClientRequest, mode?: "manual" | "revalidate") {
		const path = new URL(input.url).pathname;
		const resource = rates.resource(path);
		const blocked = rates.blocked.get(resource);
		if (blocked !== undefined && DateTime.isGreaterThan(blocked.retryAt, yield* DateTime.now)) {
			return yield* failRateLimited(path, blocked, rates.observations.get(resource)?.remaining);
		}
		const execute = send(input);
		const response = yield* (
			mode === "manual" ? execute.pipe(Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit", redirect: "manual" })) : execute
		).pipe(Effect.catchTag("HttpClientError", () => Effect.fail(new GitHubTransportError({ path }))));
		const observedResource = rates.observe(response);
		if (!((mode === "revalidate" && isUnchanged(response)) || (mode === "manual" && response.status === 302))) {
			yield* checkStatus(response, observedResource, rates.failures.get(observedResource) ?? 0).pipe(
				Effect.catchTag("HttpClientError", () => Effect.fail(new GitHubTransportError({ path }))),
				Effect.catchTag("GitHubRateLimited", (error) => {
					rates.blocked.set(error.resource, error);
					rates.failures.set(error.resource, (rates.failures.get(error.resource) ?? 0) + 1);
					return failRateLimited(path, error, rates.observations.get(error.resource)?.remaining);
				}),
			);
		}
		rates.failures.delete(observedResource);
		rates.blocked.delete(observedResource);
		return response;
	});
}
