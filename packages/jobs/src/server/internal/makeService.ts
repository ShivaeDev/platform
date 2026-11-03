import { Effect } from "effect";
import { inspection } from "#server/adapters/inspection.ts";
import type { PgBossClient } from "#server/client.ts";
import { JobEngine } from "#server/internal/engine.ts";
import { enqueueFor } from "#server/internal/enqueueFor.ts";
import { jobControl } from "#server/internal/jobControl.ts";
import type { PgBossService } from "#server/service.ts";

export const makeService = Effect.fnUntraced(function* (
	client: PgBossClient,
	names: readonly string[],
	schema = "pgboss",
): Effect.fn.Return<PgBossService, never, JobEngine> {
	const engine = yield* JobEngine;
	const reads = yield* inspection(client, schema);
	return {
		counts: (queue) => reads.counts(queue),
		deadLetteredJobs: reads.deadLetteredJobs,
		deleteQueue: engine.deleteQueue,
		enqueue: enqueueFor(client),
		failedJobs: reads.failedJobs,
		inspection: () => Effect.succeed(reads),
		...(yield* jobControl),
		health: (queues) => reads.health(queues ?? names.map((name) => ({ name }))),
		refreshQueueStats: engine.refreshQueueStats,
		unschedule: engine.unschedule,
	};
});
