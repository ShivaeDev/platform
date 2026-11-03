import { Duration, Effect } from "effect";
import type { TestClock } from "effect/testing";
import type { TestClock as PgBossTestClock } from "pg-boss";
import type { PgBossTestingError } from "#server/error.ts";
import { testingOperation } from "#server/internal/testingOperation.ts";

export function testingTime(
	clock: TestClock.TestClock | undefined,
	jobs: PgBossTestClock | undefined,
	idle: Effect.Effect<void, PgBossTestingError>,
) {
	return {
		timePasses: (duration: Duration.Input) =>
			Effect.gen(function* () {
				if (clock === undefined || jobs === undefined) {
					return yield* Effect.die(new Error("Provide the story's TestClock to makePgBossTesting before passing time"));
				}
				yield* idle;
				const next = clock.currentTimeMillisUnsafe() + Duration.toMillis(Duration.fromInputUnsafe(duration));
				yield* testingOperation("timePasses", () => jobs.setTime(next));
				yield* clock.adjust(duration);
				yield* testingOperation("timePasses", () => jobs.tick(0));
				yield* idle;
			}),
	};
}
