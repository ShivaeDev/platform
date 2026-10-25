import { Clock, DateTime, Effect } from "effect";
import type { HttpClientResponse } from "effect/http";
import type { GitHubRateLimited } from "./errors.ts";

export interface RateLimitObservation {
	readonly limit: number;
	readonly remaining: number;
	readonly reset: DateTime.Utc;
	readonly resource: string;
	readonly used: number;
}

export function rateLimits() {
	const observations = new Map<string, RateLimitObservation>();
	const blocked = new Map<string, GitHubRateLimited>();
	const resources = new Map<string, string>();
	function resource(path: string) {
		return resources.get(path) ?? (path.startsWith("/search/") ? "search" : "core");
	}
	return {
		blocked,
		observations,
		observe(response: HttpClientResponse.HttpClientResponse) {
			const headers = response.headers;
			const path = new URL(response.request.url).pathname;
			const name = headers["x-ratelimit-resource"] ?? resource(path);
			resources.set(path, name);
			const values = ["limit", "remaining", "used", "reset"].map((key) => headers[`x-ratelimit-${key}`]);
			if (values.every((value) => value !== undefined && Number.isFinite(Number(value)))) {
				observations.set(name, {
					limit: Number(headers["x-ratelimit-limit"]),
					remaining: Number(headers["x-ratelimit-remaining"]),
					reset: DateTime.makeUnsafe(Number(headers["x-ratelimit-reset"]) * 1000),
					resource: name,
					used: Number(headers["x-ratelimit-used"]),
				});
			}
			return name;
		},
		resource,
	};
}

export type RateLimits = ReturnType<typeof rateLimits>;

export const failRateLimited = Effect.fnUntraced(function* (path: string, error: GitHubRateLimited, remaining: number | undefined) {
	const fields = { path, remaining, resource: error.resource, retryAt: DateTime.formatIso(error.retryAt) };
	yield* Effect.logWarning("GitHub rate limited", fields);
	const span = yield* Effect.currentSpan.pipe(Effect.option);
	if (span._tag === "Some") {
		span.value.event("GitHub.rateLimited", yield* Clock.currentTimeNanos, fields);
	}
	return yield* error;
});
