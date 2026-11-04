import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";

export const completePublication = Effect.fnUntraced(function* <A, E, R>(
	command: Effect.Effect<A, E, R>,
	retries: number,
	tell: (line: string) => void,
) {
	const saving = yield* Effect.forkChild(command);
	for (let retry = 0; retry < retries; retry += 1) {
		const interval = 50 * 2 ** retry;
		yield* untilTimer(interval);
		tell(`the publication's ${interval} ms retry interval passes`);
		yield* TestClock.adjust(interval);
	}
	return yield* Fiber.join(saving);
});
