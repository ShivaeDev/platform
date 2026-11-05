import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const snapshot = Effect.fn("PgBossInspectionReads.snapshot")(function* (
	...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["snapshot"]>
) {
	const engine = yield* InspectionEngine;
	return yield* engine.snapshot(...args);
});
