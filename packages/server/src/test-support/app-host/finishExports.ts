import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";

export const finishExports = Effect.fnUntraced(function* <A, E, R>(work: Effect.Effect<A, E, R>) {
	const completion = yield* Effect.forkChild(work);
	const retries = untilTimer("1 second").pipe(Effect.andThen(TestClock.adjust("1 second")), Effect.forever);
	return yield* Effect.raceFirst(Fiber.join(completion), retries);
});
