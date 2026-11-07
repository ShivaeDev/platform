import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { JobEngine } from "#server/engine.ts";
import { JobQueues } from "#server/JobQueues.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { counts } from "#server/services/operations/counts.ts";
import { deleteQueue } from "#server/services/operations/deleteQueue.ts";
import { enqueue } from "#server/services/operations/enqueue.ts";
import { getJob } from "#server/services/operations/getJob.ts";
import { health } from "#server/services/operations/health.ts";
import { listJobs } from "#server/services/operations/listJobs.ts";
import { refreshQueueStats } from "#server/services/operations/refreshQueueStats.ts";
import { retry } from "#server/services/operations/retry.ts";
import { runScheduleNow } from "#server/services/operations/runScheduleNow.ts";
import { unschedule } from "#server/services/operations/unschedule.ts";
export const PgBossOperations = defineService({
	id: "@shivaedev/jobs/PgBossOperations",
	initialize: Effect.void,
	methods: () => ({ counts, deleteQueue, enqueue, getJob, health, listJobs, refreshQueueStats, retry, runScheduleNow, unschedule }),
	requires: [PgBoss, JobEngine, JobQueues],
});
