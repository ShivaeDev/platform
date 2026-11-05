import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const schemaVersion = Effect.fn("PgBossInspectionReads.schemaVersion")(function* (
	...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["schemaVersion"]>
) {
	const engine = yield* InspectionEngine;
	return yield* engine.schemaVersion(...args);
});
