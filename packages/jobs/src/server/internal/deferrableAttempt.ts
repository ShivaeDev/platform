import { Clock, DateTime, Effect, Schema } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { RetryAt } from "#definition.ts";
import { toPgBossError } from "#error.ts";
import { deferralObservers, deferredAttempt } from "#internal/deferral.ts";
import { settleDeferral } from "#internal/settleDeferral.ts";

const recordDeferral = Effect.fnUntraced(function* (at: string, reason: string) {
	const span = yield* Effect.currentSpan.pipe(Effect.orDie);
	span.event("job.deferred", yield* Clock.currentTimeNanos, { at, reason });
});

export function deferrableAttempt<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	client: PgBossClient,
	schema: string,
	job: Job<unknown>,
	maxDeferrals: number,
) {
	return effect.pipe(
		Effect.catchIf(Schema.is(RetryAt), (error) => {
			if (maxDeferrals === 0) {
				return Effect.fail(error);
			}
			const at = DateTime.formatIso(error.at);
			return Effect.tryPromise({
				catch: (failure) => toPgBossError("settle", failure, job.name),
				try: () => settleDeferral(client, schema, job, at, error.reason, maxDeferrals),
			}).pipe(
				Effect.flatMap((settled) => {
					if (settled.claimed && !settled.deferred) {
						return Effect.fail(error);
					}
					// Native batch settlement must not match a sibling's new claim at the unchanged retry count.
					job.retryCount = Number.MAX_SAFE_INTEGER;
					if (settled.deferred) {
						deferralObservers.get(client)?.();
					}
					return (settled.deferred ? recordDeferral(at, error.reason) : Effect.void).pipe(Effect.as(deferredAttempt));
				}),
			);
		}),
	);
}
