import { DateTime, Effect, Option, Schema } from "effect";
import { HttpClient, type HttpClientResponse } from "effect/http";
import { readBoundedText } from "@shivaedev/platform/http-client/body.ts";
import { filterStatus } from "@shivaedev/platform/http-client/filterStatus.ts";
import { parseRetryAfter } from "@shivaedev/platform/http-client/parseRetryAfter.ts";
import { GitHubRateLimited } from "./errors.ts";

export function isUnchanged(response: HttpClientResponse.HttpClientResponse) {
	return response.status === 304;
}

export const checkStatus = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse, resource: string) {
	const { status, headers } = response;
	if (status === 403 || status === 429) {
		const limitedByHeaders = headers["x-ratelimit-remaining"] === "0" || headers["retry-after"] !== undefined;
		const limitedByMessage = !limitedByHeaders && status === 403 && (yield* messageNamesRateLimit(response));
		if (limitedByHeaders || limitedByMessage) {
			const retryAt =
				parseRetryAfter(headers["retry-after"], yield* DateTime.now) ?? DateTime.makeUnsafe(Number(headers["x-ratelimit-reset"] ?? 0) * 1000);
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
