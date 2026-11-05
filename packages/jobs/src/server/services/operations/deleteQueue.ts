import { Effect } from "effect";
import { JobEngine } from "#server/engine.ts";
import type { PgBossService } from "#server/service.ts";
export const deleteQueue = Effect.fn("PgBossOperations.deleteQueue")(function* (...args: Parameters<PgBossService["deleteQueue"]>) {
	const engine = yield* JobEngine;
	return yield* engine.deleteQueue(...args);
});
