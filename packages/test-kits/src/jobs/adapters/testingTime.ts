import { Duration, Effect } from "effect";
import type { TestClock } from "effect/testing";
import type { PgBossTestingError } from "#jobs/error.ts";
import { testingOperation } from "#jobs/testingOperation.ts";

export function testingTime(
	clock: TestClock.TestClock | undefined,
	jobs: { readonly setTime: (time: number) => Promise<void>; readonly tick: (milliseconds: number) => Promise<void> } | undefined,
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
