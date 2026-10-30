import { DateTime, Effect, Option, Redacted } from "effect";
import { FetchHttpClient, type HttpClient, type HttpClientError, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { GitHubTransportError } from "./errors.ts";
import type { GitHubToken } from "./GitHubToken.ts";
import { failRateLimited, type RateLimits } from "./rateLimits.ts";
import { checkStatus, isUnauthorized, isUnchanged } from "./status.ts";
import type { TokenRefresh } from "./TokenRefresh.ts";

export function authenticatedRequest<R>(
	client: HttpClient.HttpClient.With<HttpClientError.HttpClientError, R>,
	token: GitHubToken["Service"],
	rates: RateLimits,
	refresh: typeof TokenRefresh.Service = undefined,
) {
	const accessToken = Effect.isEffect(token) ? token : Effect.succeed(token);
	return Effect.fnUntraced(function* (input: HttpClientRequest.HttpClientRequest, mode?: "manual" | "revalidate") {
		const path = new URL(input.url).pathname;
		const resource = rates.resource(path);
		const blocked = rates.blocked.get(resource);
		if (blocked !== undefined && DateTime.isGreaterThan(blocked.retryAt, yield* DateTime.now)) {
			return yield* failRateLimited(path, blocked, rates.observations.get(resource)?.remaining);
		}
		function send(current: Option.Option<Redacted.Redacted<string>>) {
			const sent = client.execute(withCredential(input, current));
			return (
				mode === "manual" ? sent.pipe(Effect.provideService(FetchHttpClient.RequestInit, { credentials: "omit", redirect: "manual" })) : sent
			).pipe(Effect.mapError((cause) => new GitHubTransportError({ path }, { cause })));
		}
		const credential = yield* accessToken;
		let response = yield* send(credential);
		if (isUnauthorized(response) && refresh !== undefined) {
			yield* refresh(credential);
			response = yield* send(yield* accessToken);
		}
		const observedResource = rates.observe(response);
		if (!((mode === "revalidate" && isUnchanged(response)) || (mode === "manual" && response.status === HttpStatus.fromLiteral("Found")))) {
			yield* checkStatus(response, observedResource, rates.failures.get(observedResource) ?? 0).pipe(
				Effect.catchTag("HttpClientError", (cause) => Effect.fail(new GitHubTransportError({ path }, { cause }))),
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

function withCredential(input: HttpClientRequest.HttpClientRequest, credential: Option.Option<Redacted.Redacted<string>>) {
	const request = HttpClientRequest.setHeader(input, "X-GitHub-Api-Version", "2022-11-28");
	return Option.isSome(credential) ? HttpClientRequest.setHeader(request, "Authorization", `Bearer ${Redacted.value(credential.value)}`) : request;
}
