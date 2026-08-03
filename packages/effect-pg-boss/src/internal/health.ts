import { Effect } from "effect";
import { toPgBossError } from "../error.js";
import {
	deadLetterQueueName,
	type JobsHealth,
	type QueueHealth,
} from "../health.js";
import type { PgBossClient } from "./client.js";

export const healthFor = (
	client: PgBossClient,
	names: readonly string[],
): Effect.Effect<JobsHealth, import("../error.js").PgBossError> =>
	Effect.forEach(
		names,
		(name) =>
			Effect.tryPromise({
				try: async (): Promise<QueueHealth> => {
					const [queue, deadLetter] = await Promise.all([
						client.getQueue(name),
						client.getQueue(deadLetterQueueName(name)),
					]);
					return {
						activeCount: queue?.activeCount ?? 0,
						deadLetteredCount: deadLetter?.queuedCount ?? 0,
						failedCount: queue?.failedCount ?? 0,
						name,
						queuedCount: queue?.queuedCount ?? 0,
						readyCount: queue?.readyCount ?? 0,
					};
				},
				catch: (error) => toPgBossError("health", error, name),
			}),
		{ concurrency: "unbounded" },
	).pipe(
		Effect.map((jobs) => ({
			activeTotal: jobs.reduce((sum, job) => sum + job.activeCount, 0),
			deadLetteredTotal: jobs.reduce(
				(sum, job) => sum + job.deadLetteredCount,
				0,
			),
			failedTotal: jobs.reduce((sum, job) => sum + job.failedCount, 0),
			jobs,
			queuedTotal: jobs.reduce((sum, job) => sum + job.queuedCount, 0),
			readyTotal: jobs.reduce((sum, job) => sum + job.readyCount, 0),
		})),
	);
