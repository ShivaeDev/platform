import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
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
				yield* eventually(
					Effect.flatMap(sessions(), (rows) => Effect.try(() => expect(rows).toEqual([{ count: 0 }]))),
					{ times: 100 },
				);
			}).pipe(Effect.timeout("20 seconds")),
	};
}
