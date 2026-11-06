import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { JobEngine } from "#server/engine.ts";
import { JobQueues } from "#server/JobQueues.ts";
import { PgBoss } from "#server/PgBoss.ts";
import { counts } from "./counts.ts";
import { deleteQueue } from "./deleteQueue.ts";
import { enqueue } from "./enqueue.ts";
import { getJob } from "./getJob.ts";
import { health } from "./health.ts";
import { listJobs } from "./listJobs.ts";
import { refreshQueueStats } from "./refreshQueueStats.ts";
import { retry } from "./retry.ts";
import { runScheduleNow } from "./runScheduleNow.ts";
import { unschedule } from "./unschedule.ts";
export const PgBossOperations = defineService({
	id: "@shivaedev/jobs/PgBossOperations",
	initialize: Effect.void,
	methods: () => ({ counts, deleteQueue, enqueue, getJob, health, listJobs, refreshQueueStats, retry, runScheduleNow, unschedule }),
	requires: [PgBoss, JobEngine, JobQueues],
});
