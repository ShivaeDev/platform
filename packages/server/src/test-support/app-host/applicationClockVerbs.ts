import { Duration, Effect, Stream } from "effect";
import { TestClock } from "effect/testing";
import { watchedClock } from "@shivaedev/test-story/server/watchedClock.ts";
import type { HostState } from "#test/app-host/state.ts";

export function applicationClockVerbs(state: HostState, tell: (line: string) => void) {
	return {
		applicationClockWakeups: () => Effect.sync(() => state.applicationClockWakeups),
		daysPass: (days: number) => {
			tell(`${days} days pass in one step of the host's application clock`);
			return Effect.gen(function* () {
				const clock = yield* watchedClock;
				yield* Stream.runForEach(clock.sleeps, () =>
					Effect.sync(() => {
						state.applicationClockWakeups += 1;
					}),
				).pipe(Effect.forkScoped);
				yield* TestClock.adjust(Duration.days(days));
			}).pipe(Effect.scoped);
		},
	};
}
