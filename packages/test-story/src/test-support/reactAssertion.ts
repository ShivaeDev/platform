import { Clock, Effect } from "effect";
import { withLive } from "@shivaedev/test/withLive.ts";
import { eventually } from "@shivaedev/test-story/client/react.ts";

export function reactAssertion(text: () => string) {
	let attempts = 0;
	let elapsed = 0;
	let failure: Error | undefined;
	let lastObservation: Error | undefined;
	return {
		retriesUnreadyScreen: () =>
			Effect.gen(function* () {
				const started = yield* withLive(Clock.currentTimeMillis);
				yield* eventually(() => {
					attempts += 1;
					lastObservation = new Error(`Screen reads ${JSON.stringify(text())} on attempt ${attempts}`);
					throw lastObservation;
				}).pipe(
					Effect.catch((error) =>
						Effect.sync(() => {
							failure = error;
						}),
					),
				);
				elapsed = (yield* withLive(Clock.currentTimeMillis)) - started;
			}),
		waitReport: () => ({
			attempts,
			elapsed,
			failure: failure?.message,
			lastObservation: lastObservation?.message,
			reportedElapsed: failure ? Number(/after (?<elapsed>\d+)ms/u.exec(failure.message)?.groups?.elapsed) : undefined,
			retainedLastObservation: failure !== undefined && failure.cause === lastObservation,
		}),
		waitsForText: (expected: string) =>
			eventually(() => {
				const actual = text();
				if (actual !== expected) {
					throw new Error(`Screen reads ${JSON.stringify(actual)} while waiting for ${JSON.stringify(expected)}`);
				}
			}),
	};
}
