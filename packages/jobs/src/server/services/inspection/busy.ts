import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const busy = Effect.fn("PgBossInspectionReads.busy")(function* (...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["busy"]>) {
	const engine = yield* InspectionEngine;
	return yield* engine.busy(...args);
});
