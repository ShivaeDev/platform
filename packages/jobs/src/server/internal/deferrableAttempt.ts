import { Clock, DateTime, Effect, Schema } from "effect";
import { RetryAt } from "#server/definition.ts";
import { deferredAttempt } from "#server/internal/deferral.ts";
import { type JobAttempt, JobEngine } from "#server/internal/engine.ts";

const recordDeferral = Effect.fnUntraced(function* (at: string, reason: string) {
	const span = yield* Effect.currentSpan.pipe(Effect.orDie);
	span.event("job.deferred", yield* Clock.currentTimeNanos, { at, reason });
});

export function deferrableAttempt<A, E, R>(effect: Effect.Effect<A, E, R>, job: JobAttempt, maxDeferrals: number) {
	return effect.pipe(
		Effect.catchIf(Schema.is(RetryAt), (error) => {
			if (maxDeferrals === 0) {
				return Effect.fail(error);
			}
			const at = DateTime.formatIso(error.at);
			return Effect.flatMap(JobEngine, (engine) => engine.settleDeferral(job, at, error.reason, maxDeferrals)).pipe(
				Effect.flatMap((settled) => {
					if (settled.claimed && !settled.deferred) {
						return Effect.fail(error);
					}
					return (settled.deferred ? recordDeferral(at, error.reason) : Effect.void).pipe(Effect.as(deferredAttempt));
				}),
			);
		}),
	);
}
