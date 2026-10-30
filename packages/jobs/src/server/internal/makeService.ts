import type { PgBossClient } from "#client.ts";
import { countsFor } from "#internal/countsFor.ts";
import { enqueueFor } from "#internal/enqueueFor.ts";
import { healthFor } from "#internal/healthFor.ts";
import { getJobFor, retryFor } from "#internal/jobControl.ts";
import { deadLetteredJobsFor, failedJobsFor } from "#internal/listJobs.ts";
import type { PgBossService } from "#service.ts";

export function makeService(client: PgBossClient, names: readonly string[], schema = "pgboss"): PgBossService {
	return {
		counts: (queue) => countsFor(client, schema, queue.name),
		deadLetteredJobs: deadLetteredJobsFor(client, schema),
		enqueue: enqueueFor(client),
		failedJobs: failedJobsFor(client, schema),
		getJob: getJobFor(client),
		health: () => healthFor(client, names),
		retry: retryFor(client),
	};
}
