import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { failureContext, withFailureContext } from "#engine/failureContext.ts";
import { headerCount, type ParsedResponse } from "#host/githubResponse.ts";

export type GithubPause = "rate-limit" | "reserve";
export interface GithubObservation {
	readonly limit: number;
	readonly limitedBy: GithubPause | null;
	readonly limitedUntil: number | null;
	readonly observedAt: number;
	readonly remaining: number;
	readonly reset: number;
	readonly resource: string;
	readonly used: number;
}
export type RecordedObservation = Omit<GithubObservation, "limitedBy" | "limitedUntil">;

// Every local tool shares one GitHub token, so Fleet leaves the last fifth of each budget to agents and people.
export const RESERVE_SHARE = 0.2;
const FULL_SPEED_SHARE = 0.5;
const SLOWEST_PACE_MS = 5 * 60_000;
const BACKOFF_MS = 60_000;
const BACKOFF_LIMIT_MS = 15 * 60_000;

export function githubRateLimited(error: unknown): error is ServiceUnavailable {
	return error instanceof ServiceUnavailable && failureContext(error).retryAt !== undefined;
}

export function githubFailure(message: string) {
	return (error: unknown): ServiceUnavailable => (githubRateLimited(error) ? error : new ServiceUnavailable({ message }));
}

const PAUSE_MESSAGES: Readonly<Record<GithubPause, string>> = {
	"rate-limit": "GitHub is rate-limited until",
	reserve: `GitHub paused below the ${RESERVE_SHARE * 100}% reserve until`,
};

export function githubPaused(by: GithubPause, until: number) {
	return withFailureContext(new ServiceUnavailable({ message: `${PAUSE_MESSAGES[by]} ${new Date(until).toISOString()}` }), {
		attentionOwner: "automation",
		retryAt: until,
	});
}

export function reservedUntil(observation: RecordedObservation | undefined, now: number) {
	if (observation === undefined || observation.reset * 1000 <= now) {
		return undefined;
	}
	return observation.remaining < observation.limit * RESERVE_SHARE ? observation.reset * 1000 : undefined;
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

export function rateLimitWait(response: ParsedResponse, observation: RecordedObservation | undefined, now: number, failures: number) {
	const retryAfter = headerCount(response.headers, "retry-after");
	const exhausted = observation?.remaining === 0 && observation.reset * 1000 > now ? observation.reset * 1000 : undefined;
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
	if (reset <= now || share >= FULL_SPEED_SHARE) {
		return intervalMs;
	}
	const stretch = Math.min(1, (FULL_SPEED_SHARE - share) / (FULL_SPEED_SHARE - RESERVE_SHARE)) ** 2;
	const paced = intervalMs + (Math.max(intervalMs, SLOWEST_PACE_MS) - intervalMs) * stretch;
	return Math.round(Math.max(intervalMs, Math.min(paced, reset - now)));
}
