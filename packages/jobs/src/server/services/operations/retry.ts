import { Effect } from "effect";
import { JobEngine } from "#server/engine.ts";
export const retry = Effect.fn("PgBossOperations.retry")(function* (queue: string, id: string) {
	const engine = yield* JobEngine;
	return yield* engine.retry(queue, id);
});
