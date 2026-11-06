import { Effect } from "effect";
import type { jobsEngine } from "./jobsEngine.ts";
import { refused } from "./jobsNames.ts";

export function scheduleActions(engine: Effect.Success<typeof jobsEngine>, tell: (line: string) => void) {
	return {
		runScheduleNow: (queue: string) => {
			tell(`run ${queue} now`);
			return refused(engine, engine.run(engine.api.runScheduleNow.run({ queue })).pipe(Effect.asVoid));
		},
		scheduledRuns: () => Effect.sync(() => [...engine.scheduledRuns]),
		schedules: () =>
			Effect.gen(function* () {
				const inspection = yield* engine.jobs.inspection();
				return yield* inspection.schedules();
			}),
	};
}
