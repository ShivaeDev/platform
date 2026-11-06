import { Effect } from "effect";
import { JobEngine } from "#server/engine.ts";
import type { PgBossService } from "#server/service.ts";

export const runScheduleNow = Effect.fn("PgBossOperations.runScheduleNow")(function* (...args: Parameters<PgBossService["runScheduleNow"]>) {
	const engine = yield* JobEngine;
	return yield* engine.runScheduleNow(...args);
});
