import { DateTime, Effect, Option, Schema } from "effect";
import type { HttpClientResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { readBoundedText } from "@shivaedev/http/body.ts";
import { BODY_EXCERPT_BYTES, bodyExcerpt } from "@shivaedev/http/bodyExcerpt.ts";
import { checkStatus as checkResponseStatus } from "@shivaedev/http/checkStatus.ts";
import { RemoteHttpError, type RemoteStatusError } from "@shivaedev/http/errors.ts";
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
		const body = !limitedByHeaders && status === HttpStatus.fromLiteral("Forbidden") ? yield* forbiddenBody(response) : undefined;
		const limitedByMessage = body?.message !== undefined && /rate limit/iu.test(body.message);
		if (limitedByHeaders || limitedByMessage) {
			return yield* refuseRateLimit(response, resource, failures);
		}
		const refusal = githubRefusal(body?.message, new URL(response.request.url).pathname);
		if (refusal !== undefined) {
			return yield* refusal;
		}
		// The body is already read here, so the status failure would find it consumed and lose GitHub's words.
		return yield* checkResponseStatus(response).pipe(Effect.mapError((error) => withExcerpt(error, body?.excerpt)));
	}
	return yield* checkResponseStatus(response);
});

const Message = Schema.fromJsonString(Schema.Struct({ message: Schema.String }));

export function githubMessage(text: string | undefined) {
	return text === undefined ? undefined : Option.getOrUndefined(Option.map(Schema.decodeUnknownOption(Message)(text), (body) => body.message));
}

const forbiddenBody = Effect.fnUntraced(function* (response: HttpClientResponse.HttpClientResponse) {
	const text = yield* readBoundedText(response, 64 * 1024);
	const bytes = new TextEncoder().encode(text);
	return { excerpt: bodyExcerpt(bytes.subarray(0, BODY_EXCERPT_BYTES), bytes.byteLength > BODY_EXCERPT_BYTES), message: githubMessage(text) };
});

function withExcerpt(error: RemoteStatusError, excerpt: string | undefined) {
	return excerpt === undefined || error._tag !== "RemoteHttpError"
		? error
		: new RemoteHttpError({ bodyExcerpt: excerpt, method: error.method, status: error.status, url: error.url });
}

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
