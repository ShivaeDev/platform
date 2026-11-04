import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { counts } from "#server/internal/operations/counts.ts";
import { deadLetteredJobs } from "#server/internal/operations/deadLetteredJobs.ts";
import { deleteQueue } from "#server/internal/operations/deleteQueue.ts";
import { enqueue } from "#server/internal/operations/enqueue.ts";
import { failedJobs } from "#server/internal/operations/failedJobs.ts";
import { getJob } from "#server/internal/operations/getJob.ts";
import { health } from "#server/internal/operations/health.ts";
import { inspection } from "#server/internal/operations/inspection.ts";
import { refreshQueueStats } from "#server/internal/operations/refreshQueueStats.ts";
import { retry } from "#server/internal/operations/retry.ts";
import { unschedule } from "#server/internal/operations/unschedule.ts";
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
