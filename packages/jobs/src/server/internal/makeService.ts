import type { PgBossClient } from "#server/client.ts";
import { countsFor } from "#server/internal/countsFor.ts";
import { enqueueFor } from "#server/internal/enqueueFor.ts";
import { healthFor } from "#server/internal/healthFor.ts";
import { getJobFor, retryFor } from "#server/internal/jobControl.ts";
import { deadLetteredJobsFor, failedJobsFor } from "#server/internal/listJobs.ts";
import type { PgBossService } from "#server/service.ts";

export function makeService(client: PgBossClient, names: readonly string[], schema = "pgboss"): PgBossService {
	return {
		counts: (queue) => countsFor(client, schema, queue.name),
		deadLetteredJobs: deadLetteredJobsFor(client, schema),
		enqueue: enqueueFor(client),
		failedJobs: failedJobsFor(client, schema),
		getJob: getJobFor(client),
		health: (queues) => healthFor(client, queues === undefined ? names : queues.map((queue) => queue.name)),
		retry: retryFor(client),
	};
}
