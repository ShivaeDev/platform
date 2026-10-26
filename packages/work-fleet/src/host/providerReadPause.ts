import { Clock, Effect, Schedule, Stream } from "effect";
import { Fleet } from "#fleet.ts";

export const providerReadPause = Effect.fn("Fleet.providerReadPause")(function* (intervalMs: number) {
	const fleet = yield* Fleet;
	const nextRetry = fleet.listSnapshot().pipe(
		Effect.orDie,
		Effect.map((records) => {
			const retries = records.flatMap(({ value }) => {
				const retry = value.attempts.at(-1)?.readRetry;
				return value.step !== "waiting" && retry !== undefined ? [retry.retryAt] : [];
			});
			return retries.length === 0 ? undefined : Math.min(...retries);
		}),
	);
	// Submission fibers can persist an earlier retry after the scheduler begins its pause.
	yield* Stream.fromEffectSchedule(nextRetry, Schedule.spaced(intervalMs)).pipe(
		Stream.changes,
		Stream.switchMap((retryAt) =>
			retryAt === undefined
				? Stream.never
				: Stream.fromEffect(
						Effect.gen(function* () {
							const remaining = retryAt - (yield* Clock.currentTimeMillis);
							yield* Effect.sleep(remaining > 0 ? remaining : intervalMs);
						}),
					),
		),
		Stream.take(1),
		Stream.runDrain,
	);
});
