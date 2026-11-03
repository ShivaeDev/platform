import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { TestClock } from "effect/testing";
import { act } from "react";
import { untilTimer, watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";

function controlledClock(now: number) {
	return Effect.gen(function* () {
		yield* TestClock.setTime(now);
		const clock = yield* watchedClock;
		const run = Effect.runPromiseWith(yield* Effect.context());
		const runtime = Atom.context();
		runtime.addGlobalLayer(Layer.succeed(Clock.Clock, clock));
		return {
			advance: (milliseconds: number) => Effect.promise(() => act(() => run(TestClock.adjust(milliseconds)))),
			now: () => clock.currentTimeMillisUnsafe(),
			runtime,
			timer: (milliseconds: number) => Effect.promise(() => run(untilTimer(milliseconds))),
		};
	}).pipe(Effect.provide(TestClock.layer()));
}

export const screenClock = Effect.flatMap(Clock.currentTimeMillis, controlledClock);
