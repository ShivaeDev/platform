import { Effect } from "effect";
import { JobEngine } from "#server/engine.ts";
import type { PgBossService } from "#server/service.ts";
export const refreshQueueStats = Effect.fn("PgBossOperations.refreshQueueStats")(function* (...args: Parameters<PgBossService["refreshQueueStats"]>) {
	const engine = yield* JobEngine;
	return yield* engine.refreshQueueStats(...args);
});
