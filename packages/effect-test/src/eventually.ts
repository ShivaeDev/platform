import { Clock, type Duration, Effect, Exit, Schedule } from "effect";
import * as TestClock from "effect/testing/TestClock";

export interface EventuallyOptions {
	readonly interval?: Duration.Input;
	readonly times?: number;
}

const defaultInterval = "10 millis";

const isTestClock = (clock: Clock.Clock): clock is TestClock.TestClock =>
	"adjust" in clock;

export const eventually = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	options?: EventuallyOptions,
): Effect.Effect<A, E, R> =>
	Effect.gen(function* () {
		const interval = options?.interval ?? defaultInterval;
		const clock = yield* Clock.Clock;

		if (!isTestClock(clock)) {
			return yield* options?.times === undefined
				? Effect.retry(effect, Schedule.spaced(interval))
				: Effect.retry(effect, {
						schedule: Schedule.spaced(interval),
						times: options.times,
					});
		}

		let retriesLeft = options?.times;
		for (;;) {
			const exit = yield* Effect.exit(effect);
			if (Exit.isSuccess(exit)) {
				return exit.value;
			}
			if (retriesLeft === 0) {
				return yield* exit;
			}
			if (retriesLeft !== undefined) {
				retriesLeft -= 1;
			}
			yield* TestClock.adjust(interval);
		}
	});
