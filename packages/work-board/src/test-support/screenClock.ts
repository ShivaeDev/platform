import { Clock, Duration, Effect, Layer, Queue } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { TestClock } from "effect/testing";
import { act } from "react";
import { untilTimer, watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";

function controlledClock(now: number) {
	return Effect.gen(function* () {
		yield* TestClock.setTime(now);
		const clock = yield* watchedClock;
		const sleep = clock.sleep;
		let reconnecting = false;
		const timers = yield* Effect.acquireRelease(Queue.unbounded<Duration.Duration>(), Queue.shutdown);
		yield* Effect.acquireRelease(
			Effect.sync(() =>
				Object.assign(clock, {
					sleep: (duration: Duration.Duration) => Queue.offer(timers, duration).pipe(Effect.andThen(sleep(duration))),
				}),
			),
			() => Effect.sync(() => Object.assign(clock, { sleep })),
		);
		yield* Effect.forever(
			Effect.gen(function* () {
				const duration = yield* Queue.take(timers);
				const milliseconds = Duration.toMillis(duration);
				if (milliseconds === 20 || (reconnecting && milliseconds < 60_000 && milliseconds !== 15_000)) {
					yield* clock.adjust(duration);
				}
			}),
		).pipe(Effect.forkScoped);
		const run = Effect.runPromiseWith(yield* Effect.context());
		const runtime = Atom.context();
		runtime.addGlobalLayer(Layer.succeed(Clock.Clock, clock));
		return {
			advance: (milliseconds: number) => Effect.promise(() => act(() => run(TestClock.adjust(milliseconds)))),
			drive: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
				Effect.acquireUseRelease(
					Effect.sync(() => {
						reconnecting = true;
					}),
					() => Effect.promise(() => act(() => run(clock.adjust("5 seconds")))).pipe(Effect.andThen(effect)),
					() =>
						Effect.sync(() => {
							reconnecting = false;
						}),
				),
			now: () => clock.currentTimeMillisUnsafe(),
			runtime,
			timer: (milliseconds: number) => Effect.promise(() => run(untilTimer(milliseconds))),
		};
	}).pipe(Effect.provide(TestClock.layer()));
}

export const screenClock = Effect.flatMap(Clock.currentTimeMillis, controlledClock);
