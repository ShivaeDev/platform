import { Clock, Deferred, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

export const rejectionBackoff = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	const first = yield* Deferred.make<void>();
	const second = yield* Deferred.make<void>();
	const waits = [first, second] as const;
	const delays = [30_000, 60_000] as const;
	return {
		advance: (index: 0 | 1) => Deferred.await(waits[index]).pipe(Effect.andThen(Effect.yieldNow), Effect.andThen(TestClock.adjust(delays[index]))),
		clock: {
			...clock,
			sleep: (duration: Duration.Duration) =>
				Effect.gen(function* () {
					const millis = Duration.toMillis(duration);
					if (millis === 30_000 || millis === 60_000) {
						yield* Deferred.succeed(millis === 30_000 ? first : second, undefined);
					}
					yield* clock.sleep(duration);
				}),
		},
	};
});
