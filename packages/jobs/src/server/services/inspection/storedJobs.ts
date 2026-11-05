import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const storedJobs = Effect.fn("PgBossInspectionReads.storedJobs")(function* (
	...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["storedJobs"]>
) {
	const engine = yield* InspectionEngine;
	return yield* engine.storedJobs(...args);
});
