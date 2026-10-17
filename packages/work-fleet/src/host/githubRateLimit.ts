import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { failureContext, withFailureContext } from "#engine/failureContext.ts";
import { headerCount, type ParsedResponse } from "#host/githubResponse.ts";

export interface GithubObservation {
	readonly limit: number;
	readonly limitedUntil: number | null;
	readonly observedAt: number;
	readonly remaining: number;
	readonly reset: number;
	readonly resource: string;
	readonly used: number;
}
export type RecordedObservation = Omit<GithubObservation, "limitedUntil">;

const SLOWEST_PACE_MS = 5 * 60_000;
const BACKOFF_MS = 60_000;
const BACKOFF_LIMIT_MS = 15 * 60_000;

export function githubRateLimited(error: unknown): error is ServiceUnavailable {
	return error instanceof ServiceUnavailable && failureContext(error).retryAt !== undefined;
}

export function githubFailure(message: string) {
	return (error: unknown): ServiceUnavailable => (githubRateLimited(error) ? error : new ServiceUnavailable({ message }));
}

export function rateLimitedUntil(until: number) {
	return withFailureContext(new ServiceUnavailable({ message: `GitHub is rate-limited until ${new Date(until).toISOString()}` }), {
		attentionOwner: "automation",
		retryAt: until,
	});
}

export function readObservation(headers: ReadonlyMap<string, string>, observedAt: number): RecordedObservation | undefined {
	const resource = headers.get("x-ratelimit-resource");
	const limit = headerCount(headers, "x-ratelimit-limit");
	const remaining = headerCount(headers, "x-ratelimit-remaining");
	const reset = headerCount(headers, "x-ratelimit-reset");
	if (resource === undefined || limit === undefined || remaining === undefined || reset === undefined) {
		return undefined;
	}
	return { limit, observedAt, remaining, reset, resource, used: headerCount(headers, "x-ratelimit-used") ?? limit - remaining };
}

export function exhaustedUntil(observation: RecordedObservation | undefined, now: number) {
	return observation?.remaining === 0 && observation.reset * 1000 > now ? observation.reset * 1000 : undefined;
}

export function rateLimitWait(response: ParsedResponse, observation: RecordedObservation | undefined, now: number, failures: number) {
	const retryAfter = headerCount(response.headers, "retry-after");
	const exhausted = exhaustedUntil(observation, now);
	const limited = observation?.remaining === 0 || retryAfter !== undefined || /rate limit/iu.test(response.body);
	if (!([403, 429].includes(response.status) && limited)) {
		return undefined;
	}
	if (retryAfter !== undefined) {
		return now + retryAfter * 1000;
	}
	return exhausted ?? now + Math.min(BACKOFF_LIMIT_MS, BACKOFF_MS * 2 ** failures);
}

export function pace(observation: GithubObservation | undefined, intervalMs: number, now: number) {
	if (observation === undefined) {
		return intervalMs;
	}
	if (observation.limitedUntil !== null && observation.limitedUntil > now) {
		return Math.max(intervalMs, observation.limitedUntil - now);
	}
	const reset = observation.reset * 1000;
	const share = observation.remaining / Math.max(1, observation.limit);
	if (reset <= now || share >= 0.5) {
		return intervalMs;
	}
	const stretch = ((0.5 - share) / 0.5) ** 2;
	const paced = intervalMs + (Math.max(intervalMs, SLOWEST_PACE_MS) - intervalMs) * stretch;
	return Math.round(Math.max(intervalMs, Math.min(paced, reset - now)));
}
