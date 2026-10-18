import { Effect, Fiber, Schedule } from "effect";
import { expect } from "vitest";
import type { DatabaseEngine } from "./databaseEngine.ts";

export function budgetVerbs(engine: DatabaseEngine) {
	function sessions() {
		return engine.admin<{ count: number }>`select count(*)::int as count from pg_stat_activity where application_name = ${engine.marker}`;
	}
	return {
		connectionBudgetIsRespected: () =>
			Effect.gen(function* () {
				const poolSize = engine.options.maxConnections ?? 2;
				const count = engine.pressureCount;
				const pressure = engine.pressure;
				if (pressure === undefined) {
					return yield* Effect.die("Set up clones with databasesUnderPressure first.");
				}
				yield* pressure.ready;
				yield* Effect.sleep("100 millis");
				expect(yield* sessions()).toEqual([{ count: count * poolSize }]);
				yield* pressure.release;
				expect((yield* Fiber.join(pressure.clones)).flat()).toHaveLength(count * 6);
				yield* engine.close();
				const closed = yield* sessions().pipe(
					Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: ([row]) => row?.count !== 0 }),
					Effect.timeout("5 seconds"),
				);
				expect(closed).toEqual([{ count: 0 }]);
			}).pipe(Effect.timeout("20 seconds")),
	};
}
