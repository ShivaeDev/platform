import { DateTime, Effect, Option, Redacted, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { manualRedirects } from "#adapters/manualRedirects.ts";
import { GitHubTransportError } from "#errors.ts";
import { GitHubToken } from "#GitHubToken.ts";
import { failRateLimited, type RateLimits } from "#rateLimits.ts";
import { checkStatus, isUnauthorized, isUnchanged } from "#status.ts";
import { TokenRefresh } from "#TokenRefresh.ts";

export function authenticatedRequest(rates: RateLimits) {
	return Effect.fnUntraced(function* (input: HttpClientRequest.HttpClientRequest, mode?: "manual" | "revalidate") {
		const client = HttpClient.withScope(yield* HttpClient.HttpClient);
		const token = yield* GitHubToken;
		const refresh = yield* TokenRefresh;
		const accessToken = Effect.isEffect(token) ? token : Effect.succeed(token);
		const path = new URL(input.url).pathname;
		const resource = rates.resource(path);
		const blocked = rates.blocked.get(resource);
		if (blocked !== undefined && DateTime.isGreaterThan(blocked.retryAt, yield* DateTime.now)) {
			return yield* failRateLimited(path, blocked, rates.observations.get(resource)?.remaining);
		}
		function send(current: Option.Option<Redacted.Redacted<string>>) {
			const sent = client.execute(withCredential(input, current));
			return (mode === "manual" ? manualRedirects(sent) : sent).pipe(Effect.mapError((cause) => new GitHubTransportError({ path }, { cause })));
		}
		const credential = yield* accessToken;
		let response = yield* send(credential);
		if (isUnauthorized(response) && refresh !== undefined) {
			yield* Effect.scoped(Stream.toPull(response.stream));
			yield* refresh(credential);
			response = yield* send(yield* accessToken);
		}
		const observedResource = rates.observe(response);
		if (!((mode === "revalidate" && isUnchanged(response)) || (mode === "manual" && response.status === HttpStatus.fromLiteral("Found")))) {
			yield* checkStatus(response, observedResource, rates.failures.get(observedResource) ?? 0).pipe(
				Effect.onError(() => Effect.scoped(Stream.toPull(response.stream))),
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
