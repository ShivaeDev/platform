import { Context, Effect } from "effect";
import { inspection } from "#server/adapters/inspection.ts";
import { enqueuePayload } from "#server/enqueuePayload.ts";
import { getJob } from "#server/getJob.ts";
import { deadLetteredJobs, failedJobs } from "#server/jobListings.ts";
import type { PgBossService } from "#server/service.ts";
import { PgBossOperations } from "#server/services/operations/service.ts";

export const makeService = Effect.fnUntraced(function* (): Effect.fn.Return<
	PgBossService,
	never,
	"@shivaedev/jobs/PgBossOperations" | "@shivaedev/jobs/PgBossInspectionReads"
> {
	const ambient = yield* Effect.context<"@shivaedev/jobs/PgBossOperations">();
	const context = Context.pick(PgBossOperations)(ambient);
	const operations = yield* PgBossOperations;
	const reads = yield* inspection();
	return {
		counts: operations.counts,
		deadLetteredJobs: (queue, options) => deadLetteredJobs(queue, options).pipe(Effect.provide(context)),
		deleteQueue: operations.deleteQueue,
		enqueue: (queue, payload, options) => enqueuePayload(queue, payload, options).pipe(Effect.provide(context)),
		failedJobs: (queue, options) => failedJobs(queue, options).pipe(Effect.provide(context)),
		getJob: (queue, id) => getJob(queue, id).pipe(Effect.provide(context)),
		health: operations.health,
		inspection: () => Effect.succeed(reads),
		refreshQueueStats: operations.refreshQueueStats,
		retry: (queue, id) => operations.retry(queue.name, id),
		runScheduleNow: operations.runScheduleNow,
		unschedule: operations.unschedule,
	};
});
