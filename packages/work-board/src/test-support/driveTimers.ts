import { Duration, Effect, Queue } from "effect";
import { TestClock } from "effect/testing";

interface Timer {
	active: boolean;
	readonly deadline: number;
}

export const driveTimers = Effect.fn("Story.driveTimers")(function* (selected: (duration: Duration.Duration) => Effect.Effect<boolean>) {
	const clock = yield* TestClock.testClockWith(Effect.succeed);
	const timers = yield* Effect.acquireRelease(Queue.unbounded<Timer>(), Queue.shutdown);
	const sleep = clock.sleep;
	function drivenSleep(duration: Duration.Duration) {
		return Effect.gen(function* () {
			if (!(yield* selected(duration))) {
				return yield* sleep(duration);
			}
			const timer = { active: true, deadline: clock.currentTimeMillisUnsafe() + Duration.toMillis(duration) };
			return yield* Queue.offer(timers, timer).pipe(
				Effect.andThen(sleep(duration)),
				Effect.ensuring(
					Effect.sync(() => {
						timer.active = false;
					}),
				),
			);
		});
	}
	yield* Effect.acquireRelease(
		Effect.sync(() => Object.assign(clock, { sleep: drivenSleep })),
		() => Effect.sync(() => Object.assign(clock, { sleep })),
	);
	// A queued sleep may have completed or been cancelled while an earlier timer advanced the clock.
	yield* Effect.forever(
		Effect.gen(function* () {
			const timer = yield* Queue.take(timers);
			if (timer.active) {
				yield* clock.adjust(Math.max(0, timer.deadline - clock.currentTimeMillisUnsafe()));
			}
		}),
	).pipe(Effect.forkScoped);
});
