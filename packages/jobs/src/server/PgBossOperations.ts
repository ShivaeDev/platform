import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { counts } from "#server/operations/counts.ts";
import { deadLetteredJobs } from "#server/operations/deadLetteredJobs.ts";
import { deleteQueue } from "#server/operations/deleteQueue.ts";
import { enqueue } from "#server/operations/enqueue.ts";
import { failedJobs } from "#server/operations/failedJobs.ts";
import { getJob } from "#server/operations/getJob.ts";
import { health } from "#server/operations/health.ts";
import { inspection } from "#server/operations/inspection.ts";
import { refreshQueueStats } from "#server/operations/refreshQueueStats.ts";
import { retry } from "#server/operations/retry.ts";
import { unschedule } from "#server/operations/unschedule.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { initializeJobs } from "./initializeJobs.ts";
import { PgBossInitialization } from "./PgBossInitialization.ts";

export const PgBossOperations = defineService({
	id: "@shivaedev/jobs/PgBossOperations",
	initialize: initializeJobs,
	methods: (state) => ({
		counts: counts(state),
		deadLetteredJobs: genericMethod(deadLetteredJobs(state)),
		deleteQueue: deleteQueue(state),
		enqueue: genericMethod(enqueue(state)),
		failedJobs: genericMethod(failedJobs(state)),
		getJob: genericMethod(getJob(state)),
		health: health(state),
		inspection: inspection(state),
		refreshQueueStats: refreshQueueStats(state),
		retry: retry(state),
		unschedule: unschedule(state),
	}),
	requires: [PgBoss, PgBossInitialization],
});
