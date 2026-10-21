import { Effect, Fiber, Schedule } from "effect";
import type { DatabaseEngine } from "./databaseEngine.ts";
export function budgetVerbs(engine: DatabaseEngine) {
	function sessions() {
		return engine.admin<{ count: number }>`select count(*)::int as count from pg_stat_activity where application_name = ${engine.marker}`;
	}
	function pressure() {
		if (engine.pressure === undefined) {
			throw new Error("Set up clones with databasesUnderPressure first.");
		}
		return engine.pressure;
	}
	return {
		awaitClosedSessions: () =>
			sessions().pipe(Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: ([row]) => row?.count !== 0 }), Effect.timeout("5 seconds")),
		awaitPressure: () => Effect.andThen(pressure().ready, Effect.sleep("100 millis")),
		joinClones: () => Effect.map(Fiber.join(pressure().clones), (rows) => rows.flat()),
		readSessions: sessions,
		releasePressure: () => pressure().release,
	};
}
