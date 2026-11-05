import { Context, Effect } from "effect";
import { getJob } from "#server/getJob.ts";
import type { PgBossInspectionService } from "#server/inspection.ts";
import { inspectionJobs } from "#server/inspectionJobs.ts";
import { inspectionSnapshot } from "#server/inspectionSnapshot.ts";
import { deadLetteredJobs, failedJobs } from "#server/jobListings.ts";
import { PgBossInspectionReads } from "#server/services/inspection/service.ts";
import { PgBossOperations } from "#server/services/operations/service.ts";

export const inspection = Effect.fnUntraced(function* (): Effect.fn.Return<
	PgBossInspectionService,
	never,
	"@shivaedev/jobs/PgBossInspectionReads" | "@shivaedev/jobs/PgBossOperations"
> {
	const ambient = yield* Effect.context<"@shivaedev/jobs/PgBossInspectionReads" | "@shivaedev/jobs/PgBossOperations">();
	const context = Context.pick(PgBossOperations, PgBossInspectionReads)(ambient);
	const reads = yield* PgBossInspectionReads;
	return {
		...reads,
		deadLetteredJobs: (queue, options) => deadLetteredJobs(queue, options).pipe(Effect.provide(context)),
		failedJobs: (queue, options) => failedJobs(queue, options).pipe(Effect.provide(context)),
		getJob: (queue, id) => getJob(queue, id).pipe(Effect.provide(context)),
		jobs: (queue, options) => inspectionJobs(queue, options).pipe(Effect.provide(context)),
		snapshot: (queues) => inspectionSnapshot(queues).pipe(Effect.provide(context)),
	};
});
