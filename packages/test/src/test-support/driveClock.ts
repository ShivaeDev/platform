import { Clock, type Duration, Effect, Fiber, Queue } from "effect";
import * as TestClock from "effect/testing/TestClock";

export function driveClock<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.gen(function* () {
		const driver = yield* TestClock.make();
		const events = yield* Queue.unbounded<Duration.Duration | undefined>();
		// Omit TestClock's controls so the engine exercises its ordinary Clock path.
		const clock: Clock.Clock = {
			currentTimeMillis: driver.currentTimeMillis,
			currentTimeMillisUnsafe: driver.currentTimeMillisUnsafe,
			currentTimeNanos: driver.currentTimeNanos,
			currentTimeNanosUnsafe: driver.currentTimeNanosUnsafe,
			monotonicTimeNanos: driver.monotonicTimeNanos,
			monotonicTimeNanosUnsafe: driver.monotonicTimeNanosUnsafe,
			sleep: (duration) => Effect.andThen(Queue.offer(events, duration), driver.sleep(duration)),
		};
		const fiber = yield* effect.pipe(Effect.provideService(Clock.Clock, clock), Effect.ensuring(Queue.offer(events, undefined)), Effect.forkChild);
		for (;;) {
			const duration = yield* Queue.take(events);
			if (duration === undefined) {
				return yield* Fiber.join(fiber);
			}
			yield* driver.adjust(duration);
		}
	}).pipe(Effect.scoped);
}
