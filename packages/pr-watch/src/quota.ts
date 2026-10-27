import { DateTime } from "effect";
import type { RateLimitObservation } from "@shivaedev/github/rateLimits.ts";

export function quotaRetryAt(observations: readonly RateLimitObservation[], retryAt = 0): number {
	return Math.max(retryAt, ...observations.filter((budget) => budget.remaining === 0).map((budget) => DateTime.toEpochMillis(budget.reset)));
}

export function pollDelay(observations: readonly RateLimitObservation[], interval: number, requests: number, now: number, retryAt = 0): number {
	return pollPacing(observations, interval, requests, now, retryAt).delay;
}
export function quotaMessage(budget: RateLimitObservation): string {
	return `${budget.resource}: ${budget.remaining}/${budget.limit} remaining; reset ${DateTime.formatIso(budget.reset)}`;
}

export function pollPacing(observations: readonly RateLimitObservation[], interval: number, requests: number, now: number, retryAt = 0) {
	let delay = Math.max(interval, retryAt - now);
	let message = "GitHub retry-after";
	for (const budget of observations) {
		const untilReset = DateTime.toEpochMillis(budget.reset) - now;
		if (untilReset <= 0) {
			continue;
		}
		const paced = budget.remaining === 0 ? untilReset : Math.min(untilReset, Math.ceil((untilReset * requests) / budget.remaining));
		if (paced > interval && paced >= delay) {
			delay = paced;
			message = `GitHub quota pacing (${quotaMessage(budget)})`;
		}
	}
	return { delay, message };
}
