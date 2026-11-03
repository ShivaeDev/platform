import { Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { countsFor } from "#server/internal/countsFor.ts";
import type { JobEngine } from "#server/internal/engine.ts";
import { enqueueFor } from "#server/internal/enqueueFor.ts";
import { healthFor } from "#server/internal/healthFor.ts";
import { jobControl } from "#server/internal/jobControl.ts";
import { jobListings } from "#server/internal/jobListings.ts";
import type { PgBossService } from "#server/service.ts";

export const makeService = Effect.fnUntraced(function* (
	client: PgBossClient,
	names: readonly string[],
	schema = "pgboss",
): Effect.fn.Return<PgBossService, never, JobEngine> {
	return {
		counts: (queue) => countsFor(client, schema, queue.name),
		...(yield* jobListings),
		enqueue: enqueueFor(client),
		...(yield* jobControl),
		health: (queues) => healthFor(client, queues === undefined ? names : queues.map((queue) => queue.name)),
	};
});
