import { DateTime } from "effect";
import type { RateLimitObservation } from "@shivaedev/github/rateLimits.ts";

export function quotaRetryAt(observations: readonly RateLimitObservation[], retryAt = 0): number {
	return Math.max(retryAt, ...observations.filter((budget) => budget.remaining === 0).map((budget) => DateTime.toEpochMillis(budget.reset)));
}

export function pollDelay(observations: readonly RateLimitObservation[], interval: number, requests: number, now: number, retryAt = 0): number {
	return Math.max(
		interval,
		quotaRetryAt(observations, retryAt) - now,
		...observations.map((budget) => {
			const ratio = budget.remaining / Math.max(1, budget.limit);
			const reset = DateTime.toEpochMillis(budget.reset);
			const paced = budget.remaining > 0 && ratio < 0.5 ? Math.ceil((Math.max(0, reset - now) * requests) / budget.remaining) : 0;
			return Math.max(interval * slowdown(ratio), paced);
		}),
	);
}
function slowdown(ratio: number): number {
	if (ratio < 0.1) {
		return 10;
	}
	if (ratio < 0.2) {
		return 5;
	}
	if (ratio < 0.5) {
		return 2;
	}
	return 1;
}
