import { Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { toPgBossError } from "#server/error.ts";
import { deadLetterQueueName, type JobsHealth, type QueueHealth } from "#server/health.ts";

export function healthFor(client: PgBossClient, names: readonly string[]): Effect.Effect<JobsHealth, import("#server/error.ts").PgBossError> {
	return Effect.forEach(
		names,
		(name) =>
			Effect.tryPromise({
				catch: (error) => toPgBossError("health", error, name),
				try: async (): Promise<QueueHealth> => {
					const [queue, deadLetter] = await Promise.all([client.getQueue(name), client.getQueue(deadLetterQueueName(name))]);
					return {
						activeCount: queue?.activeCount ?? 0,
						deadLetteredCount: deadLetter?.queuedCount ?? 0,
						failedCount: queue?.failedCount ?? 0,
						name,
						queuedCount: queue?.queuedCount ?? 0,
						readyCount: queue?.readyCount ?? 0,
					};
				},
			}),
		{ concurrency: "unbounded" },
	).pipe(
		Effect.map((jobs) => ({
			activeTotal: jobs.reduce((sum, job) => sum + job.activeCount, 0),
			deadLetteredTotal: jobs.reduce((sum, job) => sum + job.deadLetteredCount, 0),
			failedTotal: jobs.reduce((sum, job) => sum + job.failedCount, 0),
			jobs,
			queuedTotal: jobs.reduce((sum, job) => sum + job.queuedCount, 0),
			readyTotal: jobs.reduce((sum, job) => sum + job.readyCount, 0),
		})),
	);
}
