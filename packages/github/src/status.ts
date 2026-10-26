import { DateTime, Effect, Option, Schema } from "effect";
import { HttpClient, type HttpClientResponse } from "effect/http";
import { readBoundedText } from "@shivaedev/platform/http-client/body.ts";
import { filterStatus } from "@shivaedev/platform/http-client/filterStatus.ts";
import { parseRetryAfter } from "@shivaedev/platform/http-client/parseRetryAfter.ts";
import { GitHubConversationLocked, GitHubPermissionDenied, GitHubRateLimited } from "#errors.ts";

export function isUnauthorized(response: HttpClientResponse.HttpClientResponse) {
	return response.status === 401;
}

export function isUnchanged(response: HttpClientResponse.HttpClientResponse) {
	return response.status === 304;
}

export const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, resource: string, failures = 0) {
	const { status, headers } = response;
	if (status === 403 || status === 429) {
		const limitedByHeaders = status === 429 || headers["x-ratelimit-remaining"] === "0" || headers["retry-after"] !== undefined;
		const message = !limitedByHeaders && status === 403 ? yield* responseMessage(response) : undefined;
		const limitedByMessage = message !== undefined && /rate limit/iu.test(message);
		if (limitedByHeaders || limitedByMessage) {
			return yield* refuseRateLimit(response, resource, failures);
		}
		const refusal = githubRefusal(message, new URL(response.request.url).pathname);
		if (refusal !== undefined) {
			return yield* refusal;
		}
	}
	return yield* filterStatus(HttpClient.makeWith(() => Effect.succeed(response), Effect.succeed)).execute(response.request);
});

const Message = Schema.fromJsonString(Schema.Struct({ message: Schema.String }));

const responseMessage = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const text = yield* readBoundedText(response, 64 * 1024);
	const body = Schema.decodeUnknownOption(Message)(text);
	return Option.isSome(body) ? body.value.message : undefined;
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
	const reset = Number(headers["x-ratelimit-reset"] ?? 0) * 1000;
	const fallback =
		headers["x-ratelimit-remaining"] === "0" && reset > DateTime.toEpochMillis(now)
			? reset
			: DateTime.toEpochMillis(now) + Math.min(15 * 60_000, 60_000 * 2 ** failures);
	const retryAt = parseRetryAfter(headers["retry-after"], now) ?? DateTime.makeUnsafe(fallback);
	return yield* new GitHubRateLimited({ resource, retryAt });
});
