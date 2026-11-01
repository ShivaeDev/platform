import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { type UntilOptions, until } from "#until.ts";

export interface WatchedClock extends TestClock.TestClock {
	readonly sleeps: Stream.Stream<Duration.Duration>;
}

export const watchedClock = TestClock.testClockWith((clock) =>
	Effect.gen(function* () {
		const starts = yield* Effect.acquireRelease(Queue.unbounded<Duration.Duration>(), Queue.shutdown);
		const sleep = clock.sleep;
		const previous = Object.getOwnPropertyDescriptor(clock, "sleeps");
		const watching = {
			sleep: (duration: Duration.Duration) => Queue.offer(starts, duration).pipe(Effect.andThen(sleep(duration))),
			sleeps: Stream.fromEffectRepeat(Queue.take(starts)),
		};
		// Native TestClock tracks its live clock by instance identity.
		return yield* Effect.acquireRelease(
			Effect.sync((): WatchedClock => Object.assign(clock, watching)),
			() =>
				Effect.sync(() => {
					Object.assign(clock, { sleep });
					if (previous === undefined) {
						Reflect.deleteProperty(clock, "sleeps");
					} else {
						Object.defineProperty(clock, "sleeps", previous);
					}
				}),
		);
	}),
);

function isWatchedClock(clock: Clock.Clock): clock is WatchedClock {
	return "sleeps" in clock;
}

export function untilTimer(interval: Duration.Input, options?: Omit<UntilOptions, "name">) {
	const duration = Duration.fromInputUnsafe(interval);
	return Clock.clockWith((clock) =>
		isWatchedClock(clock)
			? until(clock.sleeps, Duration.equals(duration), { ...options, name: `sleep for ${Duration.toMillis(duration)}ms` })
			: Effect.die(new Error('untilTimer requires a watched TestClock.\nhelp: Use clock: "test" on storyKit or provide watchedClock as Clock.')),
	);
}

export function passes<A, E, R>(interval: Duration.Input, then: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> {
	return TestClock.adjust(interval).pipe(Effect.andThen(then));
}
