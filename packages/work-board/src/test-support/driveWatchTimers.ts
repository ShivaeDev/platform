import { Clock, Duration, Effect, Stream } from "effect";
import { TestClock } from "effect/testing";
import type { WatchedClock } from "@shivaedev/test-story/server/watchedClock.ts";

const draining = new WeakSet<Clock.Clock>();

function watched(clock: Clock.Clock): clock is WatchedClock {
	return "sleeps" in clock;
}

// Only watcher debounce and exponential retry timers run automatically. Readiness, reconciliation and request deadlines stay under the story's control.
export const driveWatchTimers = Effect.fn("Story.driveWatchTimers")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const clock = yield* Clock.Clock;
	if (!watched(clock)) {
		return yield* Effect.die("Work Board stories require a controlled clock");
	}
	const timers = clock.sleeps.pipe(
		Stream.filter((duration) => {
			const milliseconds = Duration.toMillis(duration);
			return [100, 200, 400, 800, 1600, 3200].includes(milliseconds) || (draining.has(clock) && milliseconds === 5000);
		}),
		Stream.runForEach(TestClock.adjust),
	);
	return yield* Effect.raceFirst(effect, Effect.andThen(timers, Effect.never));
});

export const driveDrainPeriod = Effect.fn("Story.driveDrainPeriod")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	return yield* Effect.acquireUseRelease(
		Effect.tap(Clock.Clock, (clock) => Effect.sync(() => draining.add(clock))),
		() => effect,
		(clock) => Effect.sync(() => draining.delete(clock)),
	);
});
