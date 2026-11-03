import { Clock, Duration, Effect, Option, Queue, Stream, Tracer } from "effect";
import { TestClock } from "effect/testing";
import type { WatchedClock } from "@shivaedev/test-story/server/watchedClock.ts";

const heldReadiness = new WeakSet<Clock.Clock>();

export const holdReadinessRetouches = Effect.map(Clock.Clock, (clock) => heldReadiness.add(clock));

const intervals = new WeakMap<Clock.Clock, Set<number>>();

function watched(clock: Clock.Clock): clock is WatchedClock {
	return "sleeps" in clock;
}

function watcherRetry(current: Option.Option<Tracer.AnySpan>) {
	let span = current;
	while (Option.isSome(span) && span.value._tag === "Span") {
		if (span.value.name === "WorkBoard.watchSentinel") {
			return false;
		}
		if (span.value.name === "WorkBoard.watchChanges") {
			return true;
		}
		span = span.value.parent;
	}
	return false;
}

// Failure deadlines and periodic reconciliation must not advance before the story requests them.
export const driveWatchTimers = Effect.fn("Story.driveWatchTimers")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const clock = yield* Clock.Clock;
	if (!watched(clock)) {
		return yield* Effect.die("Work Board stories require a controlled clock");
	}
	const retries = yield* Effect.acquireRelease(Queue.unbounded<Duration.Duration>(), Queue.shutdown);
	const sleep = clock.sleep;
	yield* Effect.acquireRelease(
		Effect.sync(() =>
			Object.assign(clock, {
				sleep: (duration: Duration.Duration) =>
					Effect.gen(function* () {
						if (Duration.toMillis(duration) === 5000 && watcherRetry(yield* Effect.serviceOption(Tracer.ParentSpan))) {
							yield* Queue.offer(retries, duration);
						}
						return yield* sleep(duration);
					}),
			}),
		),
		() => Effect.sync(() => Object.assign(clock, { sleep })),
	);
	const timers = clock.sleeps.pipe(
		Stream.filter((duration) => {
			const milliseconds = Duration.toMillis(duration);
			return (
				(milliseconds === 50 && !heldReadiness.has(clock))
				|| [100, 200, 400, 800, 1600, 3200].includes(milliseconds)
				|| intervals.get(clock)?.has(milliseconds) === true
			);
		}),
		Stream.merge(Stream.fromQueue(retries)),
		Stream.runForEach(TestClock.adjust),
	);
	return yield* Effect.raceFirst(effect, Effect.andThen(timers, Effect.never));
});

export const driveInterval = Effect.fn("Story.driveInterval")(function* <A, E, R>(duration: Duration.Input, effect: Effect.Effect<A, E, R>) {
	const milliseconds = Duration.toMillis(Duration.fromInputUnsafe(duration));
	return yield* Effect.acquireUseRelease(
		Effect.tap(Clock.Clock, (clock) => Effect.sync(() => intervals.set(clock, new Set([milliseconds])))),
		() => TestClock.adjust(duration).pipe(Effect.andThen(effect)),
		(clock) => Effect.sync(() => intervals.delete(clock)),
	);
});
