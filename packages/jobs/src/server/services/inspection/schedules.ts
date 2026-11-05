import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const schedules = Effect.fn("PgBossInspectionReads.schedules")(function* (
	...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["schedules"]>
) {
	const engine = yield* InspectionEngine;
	return yield* engine.schedules(...args);
});
