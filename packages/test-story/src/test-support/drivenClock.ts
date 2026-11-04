import { Clock, Duration, Effect, Fiber, Queue } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { watchedClock } from "#server/watchedClock.ts";

export const drivenClock = Effect.gen(function* () {
	const initialTime = yield* Clock.currentTimeMillis;
	const deadlines = yield* TestClock.make();
	const starts = yield* Queue.unbounded<void>();
	const pending = new Map<symbol, number>();
	// A plain Clock is the external time boundary captured by nested TestClocks.
	const boundary: Clock.Clock = {
		currentTimeMillis: deadlines.currentTimeMillis,
		currentTimeMillisUnsafe: deadlines.currentTimeMillisUnsafe,
		currentTimeNanos: deadlines.currentTimeNanos,
		currentTimeNanosUnsafe: deadlines.currentTimeNanosUnsafe,
		monotonicTimeNanos: deadlines.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: deadlines.monotonicTimeNanosUnsafe,
		sleep: (duration) =>
			Effect.gen(function* () {
				const timer = Symbol("deadline");
				pending.set(timer, deadlines.currentTimeMillisUnsafe() + Duration.toMillis(duration));
				yield* Queue.offer(starts, undefined);
				return yield* deadlines.sleep(duration).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							pending.delete(timer);
						}),
					),
				);
			}),
	};
	const source = yield* TestClock.make().pipe(Effect.provideService(Clock.Clock, boundary));
	yield* source.setTime(initialTime);
	const clock = yield* watchedClock.pipe(Effect.provideService(Clock.Clock, source));
	function run<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(Effect.provideService(Clock.Clock, clock));
	}
	function drive<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.gen(function* () {
			const fiber = yield* run(effect).pipe(Effect.forkScoped({ startImmediately: true }));
			const advance = Queue.take(starts).pipe(
				Effect.flatMap(() => (pending.size === 0 ? Effect.void : deadlines.setTime(Math.min(...pending.values())))),
				Effect.forever,
			);
			return yield* Effect.raceFirst(Fiber.join(fiber), advance);
		}).pipe(Effect.scoped);
	}
	return { boundary, drive, run, time: clock.currentTimeMillis };
});
