import { Clock, type Duration, Effect, Result, Schedule } from "effect";
import * as TestClock from "effect/testing/TestClock";

export interface EventuallyOptions {
	readonly interval?: Duration.Input;
	readonly times?: number;
}

const defaultInterval = "10 millis";

function isTestClock(clock: Clock.Clock): clock is TestClock.TestClock {
	return "adjust" in clock;
}

function retryOnLiveClock<A, E, R>(effect: Effect.Effect<A, E, R>, interval: Duration.Input, times: number | undefined): Effect.Effect<A, E, R> {
	return times === undefined
		? Effect.retry(effect, Schedule.spaced(interval))
		: Effect.retry(effect, {
				schedule: Schedule.spaced(interval),
				times,
			});
}

function retryOnTestClock<A, E, R>(effect: Effect.Effect<A, E, R>, interval: Duration.Input, times: number | undefined): Effect.Effect<A, E, R> {
	return Effect.gen(function* () {
		let retriesLeft = times;
		for (;;) {
			const result = yield* Effect.result(effect);
			if (Result.isSuccess(result)) {
				return result.success;
			}
			if (retriesLeft === 0) {
				return yield* Effect.fail(result.failure);
			}
			if (retriesLeft !== undefined) {
				retriesLeft -= 1;
			}
			yield* TestClock.adjust(interval);
		}
	});
}

export const eventually = <A, E, R>(effect: Effect.Effect<A, E, R>, options?: EventuallyOptions): Effect.Effect<A, E, R> =>
	Effect.gen(function* () {
		const interval = options?.interval ?? defaultInterval;
		const clock = yield* Clock.Clock;
		const retry = isTestClock(clock) ? retryOnTestClock : retryOnLiveClock;
		return yield* retry(effect, interval, options?.times);
	});
