import { Effect } from "effect";
import { JobEngine } from "#server/engine.ts";
export const getJob = Effect.fn("PgBossOperations.getJob")(function* (queue: string, id: string) {
	const engine = yield* JobEngine;
	return yield* engine.getJob(queue, id);
});
