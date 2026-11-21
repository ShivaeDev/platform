import { Clock, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import type { DatabaseEngine } from "#test/postgres/databaseEngine.ts";

export const passTime = Effect.fnUntraced(function* (engine: DatabaseEngine, duration: Duration.Input) {
	const millis = Duration.toMillis(Duration.fromInputUnsafe(duration));
	const now = yield* Clock.currentTimeMillis;
	yield* Effect.promise(() => engine.clock.setTime(now + millis));
	yield* TestClock.adjust(duration);
	yield* Effect.promise(() => engine.clock.tick(0));
});

export function timeVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
		pgBossClockPasses: (duration: Duration.Input) =>
			Effect.gen(function* () {
				tell(
					`${Duration.format(Duration.fromInputUnsafe(duration))} pass on the PostgreSQL clock and pg-boss's timers fire, while the runtime clock stands still`,
				);
				const now = yield* Clock.currentTimeMillis;
				yield* Effect.promise(() => engine.clock.setTime(now + Duration.toMillis(Duration.fromInputUnsafe(duration))));
				yield* Effect.promise(() => engine.clock.tick(0));
			}),
		runtimeClockCatchesUp: (duration: Duration.Input) => {
			tell(`the runtime clock catches up by ${Duration.format(Duration.fromInputUnsafe(duration))}`);
			return TestClock.adjust(duration);
		},
		timePasses: (duration: Duration.Input) => {
			tell(`${Duration.format(Duration.fromInputUnsafe(duration))} pass on the runtime and PostgreSQL clocks`);
			return passTime(engine, duration);
		},
		untilWakeScheduled: (duration: Duration.Input) => {
			tell(`wait until a worker schedules its wake in ${Duration.format(Duration.fromInputUnsafe(duration))}`);
			return untilTimer(duration);
		},
	};
}
