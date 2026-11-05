import { type Context, Effect } from "effect";
import { InspectionEngine } from "#server/InspectionEngine.ts";
export const deferred = Effect.fn("PgBossInspectionReads.deferred")(function* (
	...args: Parameters<Context.Service.Shape<typeof InspectionEngine>["deferred"]>
) {
	const engine = yield* InspectionEngine;
	return yield* engine.deferred(...args);
});
