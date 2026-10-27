import { Cause, DateTime, Schema } from "effect";
import { GitHubRateLimited, GitHubTransportError } from "@shivaedev/github/errors.ts";
import type { RateLimitObservation } from "@shivaedev/github/rateLimits.ts";
import { WatchError } from "#model.ts";
import { quotaMessage } from "#quota.ts";

const HttpFailure = Schema.Struct({
	method: Schema.String,
	retryAfter: Schema.optionalKey(Schema.DateTimeUtc),
	status: Schema.Number,
	url: Schema.String,
});

export function requestFailure(cause: unknown, observations: readonly RateLimitObservation[] = []): WatchError {
	if (cause instanceof WatchError) {
		return cause;
	}
	if (cause instanceof GitHubRateLimited) {
		const budget = observations.find((entry) => entry.resource === cause.resource);
		return new WatchError({
			message: `GitHub rate limit (${budget === undefined ? cause.resource : quotaMessage(budget)})`,
			retryAt: DateTime.toEpochMillis(cause.retryAt),
			retryable: true,
		});
	}
	if (cause instanceof GitHubTransportError) {
		return new WatchError({ message: `GitHub network error at ${cause.path}`, retryable: true });
	}
	if (Cause.isTimeoutError(cause)) {
		return new WatchError({ message: "GitHub request timed out after 30 seconds", retryable: true });
	}
	if (Schema.is(HttpFailure)(cause)) {
		return new WatchError({
			message: `GitHub HTTP ${cause.status} (${cause.method} ${new URL(cause.url).pathname})`,
			retryable: cause.status >= 500 && cause.status < 600,
			...(cause.retryAfter === undefined ? {} : { retryAt: DateTime.toEpochMillis(cause.retryAfter) }),
		});
	}
	return new WatchError({ message: `GitHub request failed: ${cause instanceof Error ? cause.message || cause.name : String(cause)}` });
}
