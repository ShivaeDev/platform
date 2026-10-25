import { DateTime, Effect, Option, Schema } from "effect";
import { HttpClient, type HttpClientResponse } from "effect/http";
import { readBoundedText } from "@shivaedev/platform/http-client/body.ts";
import { filterStatus } from "@shivaedev/platform/http-client/filterStatus.ts";
import { parseRetryAfter } from "@shivaedev/platform/http-client/parseRetryAfter.ts";
import { GitHubRateLimited } from "./errors.ts";

export function isUnchanged(response: HttpClientResponse.HttpClientResponse) {
	return response.status === 304;
}

export const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, resource: string, failures = 0) {
	const { status, headers } = response;
	if (status === 403 || status === 429) {
		const limitedByHeaders = status === 429 || headers["x-ratelimit-remaining"] === "0" || headers["retry-after"] !== undefined;
		const limitedByMessage = !limitedByHeaders && status === 403 && (yield* messageNamesRateLimit(response));
		if (limitedByHeaders || limitedByMessage) {
			const now = yield* DateTime.now;
			const reset = Number(headers["x-ratelimit-reset"] ?? 0) * 1000;
			const fallback =
				headers["x-ratelimit-remaining"] === "0" && reset > DateTime.toEpochMillis(now)
					? reset
					: DateTime.toEpochMillis(now) + Math.min(15 * 60_000, 60_000 * 2 ** failures);
			const retryAt = parseRetryAfter(headers["retry-after"], now) ?? DateTime.makeUnsafe(fallback);
			return yield* new GitHubRateLimited({ resource, retryAt });
		}
	}
	return yield* filterStatus(HttpClient.makeWith(() => Effect.succeed(response), Effect.succeed)).execute(response.request);
});

const Message = Schema.fromJsonString(Schema.Struct({ message: Schema.String }));

const messageNamesRateLimit = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const text = yield* readBoundedText(response, 64 * 1024);
	const body = Schema.decodeUnknownOption(Message)(text);
	return Option.isSome(body) && /rate limit/iu.test(body.value.message);
});
