import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { type UntilOptions, until } from "#server/until.ts";

export interface WatchedClock extends TestClock.TestClock {
	readonly sleeps: Stream.Stream<Duration.Duration>;
}

export interface ScreenClock extends WatchedClock {
	readonly advanceNext: Effect.Effect<boolean>;
}

export const watchedClock = TestClock.testClockWith((clock) =>
	Effect.gen(function* () {
		const deadlines = new Map<object, number>();
		const starts = yield* Effect.acquireRelease(Queue.unbounded<Duration.Duration>(), Queue.shutdown);
		const sleep = clock.sleep;
		const previous = {
			advanceNext: Object.getOwnPropertyDescriptor(clock, "advanceNext"),
			sleeps: Object.getOwnPropertyDescriptor(clock, "sleeps"),
		};
		const watching = {
			advanceNext: Effect.suspend(() => {
				const next = Math.min(...deadlines.values());
				return Number.isFinite(next) ? clock.setTime(next).pipe(Effect.as(true)) : Effect.succeed(false);
			}),
			sleep: (duration: Duration.Duration) =>
				Effect.acquireUseRelease(
					Effect.gen(function* () {
						const now = yield* Clock.currentTimeMillis.pipe(Effect.provideService(Clock.Clock, clock));
						const token = {};
						deadlines.set(token, now + Duration.toMillis(duration));
						return token;
					}),
					() => Queue.offer(starts, duration).pipe(Effect.andThen(sleep(duration))),
					(token) =>
						Effect.sync(() => {
							deadlines.delete(token);
						}),
				),
			sleeps: Stream.fromEffectRepeat(Queue.take(starts)),
		};
		// Native TestClock tracks its live clock by instance identity.
		return yield* Effect.acquireRelease(
			Effect.sync((): ScreenClock => Object.assign(clock, watching)),
			() =>
				Effect.sync(() => {
					Object.assign(clock, { sleep });
					for (const [name, descriptor] of Object.entries(previous)) {
						if (descriptor === undefined) {
							Reflect.deleteProperty(clock, name);
						} else {
							Object.defineProperty(clock, name, descriptor);
						}
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
