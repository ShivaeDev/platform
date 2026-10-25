import { Clock, type Duration, Effect, Result, Schedule } from "effect";
import * as TestClock from "effect/testing/TestClock";

export interface EventuallyOptions {
	readonly interval?: Duration.Input;
	readonly times?: number;
}

const DEFAULT_INTERVAL = "10 millis";

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

const retryOnTestClock = Effect.fnUntraced(function* <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	interval: Duration.Input,
	times: number | undefined,
): Effect.fn.Return<A, E, R> {
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

export const eventually = Effect.fnUntraced(function* <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	options?: EventuallyOptions,
): Effect.fn.Return<A, E, R> {
	const interval = options?.interval ?? DEFAULT_INTERVAL;
	const clock = yield* Clock.Clock;
	const retry = isTestClock(clock) ? retryOnTestClock : retryOnLiveClock;
	return yield* retry(effect, interval, options?.times);
});
