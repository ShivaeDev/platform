import { Clock, Effect, Schedule, Stream } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";

export const providerReadPause = Effect.fn("Fleet.providerReadPause")(function* (intervalMs: number) {
	const fleet = yield* Fleet;
	const nextObservation = fleet.listSnapshot().pipe(
		Effect.orDie,
		Effect.map((records) => {
			const observations = records.flatMap(({ value }) => {
				const retry = value.attempts.at(-1)?.readRetry;
				if (value.step !== "waiting" && retry !== undefined) {
					return [retry.retryAt];
				}
				return executing(value) ? [0] : [];
			});
			return observations.length === 0 ? undefined : Math.min(...observations);
		}),
	);
	// GitHub pacing must not delay active turns, including submissions accepted after this pause starts.
	yield* Stream.fromEffectSchedule(nextObservation, Schedule.spaced(intervalMs)).pipe(
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
