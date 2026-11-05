import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const queue = Effect.fn("PgBossInspectionReads.queue")(function* (
	...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["queue"]>
) {
	const engine = yield* InspectionEngine;
	return yield* engine.queue(...args);
});
