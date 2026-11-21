import { DateTime, Effect, Option, Schema } from "effect";
import type { HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBoundedText } from "@shivaedev/http/body.ts";
import { checkStatus as checkResponseStatus } from "@shivaedev/http/checkStatus.ts";
import { parseRetryAfter } from "@shivaedev/http/parseRetryAfter.ts";
import { GitHubConversationLocked, GitHubPermissionDenied, GitHubRateLimited } from "#errors.ts";

export function isUnauthorized(response: HttpClientResponse.HttpClientResponse) {
	return response.status === HttpStatus.fromLiteral("Unauthorized");
}

export function isUnchanged(response: HttpClientResponse.HttpClientResponse) {
	return response.status === HttpStatus.fromLiteral("NotModified");
}

export const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, resource: string, failures = 0) {
	const { status, headers } = response;
	if (status === HttpStatus.fromLiteral("Forbidden") || status === HttpStatus.fromLiteral("TooManyRequests")) {
		const limitedByHeaders =
			status === HttpStatus.fromLiteral("TooManyRequests") || headers["x-ratelimit-remaining"] === "0" || headers["retry-after"] !== undefined;
		const message = !limitedByHeaders && status === HttpStatus.fromLiteral("Forbidden") ? yield* responseMessage(response) : undefined;
		const limitedByMessage = message !== undefined && /rate limit/iu.test(message);
		if (limitedByHeaders || limitedByMessage) {
			return yield* refuseRateLimit(response, resource, failures);
		}
		const refusal = githubRefusal(message, new URL(response.request.url).pathname);
		if (refusal !== undefined) {
			return yield* refusal;
		}
	}
	return yield* checkResponseStatus(response);
});

const Message = Schema.fromJsonString(Schema.Struct({ message: Schema.String }));

export function githubMessage(text: string | undefined) {
	return text === undefined ? undefined : Option.getOrUndefined(Option.map(Schema.decodeUnknownOption(Message)(text), (body) => body.message));
}

const responseMessage = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	return githubMessage(yield* readBoundedText(response, 64 * 1024));
});

function githubRefusal(message: string | undefined, path: string) {
	if (message === undefined) {
		return undefined;
	}
	if (/^Resource not accessible by integration$/iu.test(message)) {
		return new GitHubPermissionDenied({ path });
	}
	if (/\bconversation (?:is|has been) locked\b/iu.test(message)) {
		return new GitHubConversationLocked({ path });
	}
	return undefined;
}

const refuseRateLimit = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, resource: string, failures: number) {
	const { headers } = response;
	const now = yield* DateTime.now;
	const reset = DateTime.make(Number(headers["x-ratelimit-reset"] ?? 0) * 1000).pipe(
		Option.filter((at) => headers["x-ratelimit-remaining"] === "0" && DateTime.isGreaterThan(at, now)),
	);
	const retryAt =
		parseRetryAfter(headers["retry-after"], now)
		?? Option.getOrElse(reset, () => DateTime.add(now, { milliseconds: Math.min(15 * 60_000, 60_000 * 2 ** failures) }));
	return yield* new GitHubRateLimited({ resource, retryAt });
});
