import type { BetterAuthRateLimitOptions } from "better-auth";
import { Clock, Effect } from "effect";

interface Bucket {
	readonly count: number;
	readonly expiresAt: number;
	readonly lastRequest: number;
}

const MAX_ENTRIES = 100_000;

export const memoryRateLimit = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const buckets = yield* Effect.acquireRelease(
		Effect.sync(() => new Map<string, Bucket>()),
		(entries) => Effect.sync(() => entries.clear()),
	);
	let nextExpiry = Number.POSITIVE_INFINITY;
	function prune(now: number) {
		if (now >= nextExpiry) {
			nextExpiry = Number.POSITIVE_INFINITY;
			for (const [entryKey, entry] of buckets) {
				if (now >= entry.expiresAt) {
					buckets.delete(entryKey);
				} else {
					nextExpiry = Math.min(nextExpiry, entry.expiresAt);
				}
			}
		}
	}
	const storage: NonNullable<BetterAuthRateLimitOptions["customStorage"]> = {
		consume(key, rule) {
			const now = clock.currentTimeMillisUnsafe();
			prune(now);
			const bucket = buckets.get(key);
			const window = rule.window * 1000;
			if (bucket !== undefined && now - bucket.lastRequest < window && bucket.count >= rule.max) {
				return Promise.resolve({ allowed: false, retryAfter: Math.ceil((bucket.lastRequest + window - now) / 1000) });
			}
			nextExpiry = Math.min(nextExpiry, now + window);
			buckets.set(key, {
				count: bucket === undefined || now - bucket.lastRequest >= window ? 1 : bucket.count + 1,
				expiresAt: now + window,
				lastRequest: now,
			});
			if (buckets.size > MAX_ENTRIES) {
				for (const oldest of buckets.keys()) {
					buckets.delete(oldest);
					break;
				}
			}
			return Promise.resolve({ allowed: true, retryAfter: null });
		},
	};
	return storage;
});
