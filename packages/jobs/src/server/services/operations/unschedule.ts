import { Effect } from "effect";
import { JobEngine } from "#server/engine.ts";
import type { PgBossService } from "#server/service.ts";
export const unschedule = Effect.fn("PgBossOperations.unschedule")(function* (...args: Parameters<PgBossService["unschedule"]>) {
	const engine = yield* JobEngine;
	return yield* engine.unschedule(...args);
});
