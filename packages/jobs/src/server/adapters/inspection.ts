import { Effect } from "effect";
import { jobEngine } from "#server/adapters/jobEngine.ts";
import type { PgBossClient } from "#server/client.ts";
import type { PgBossInspectionService } from "#server/inspection.ts";
import { countsFor } from "#server/internal/countsFor.ts";
import { JobEngine } from "#server/internal/engine.ts";
import { healthFor } from "#server/internal/healthFor.ts";
import { jobControl } from "#server/internal/jobControl.ts";
import { jobListings } from "#server/internal/jobListings.ts";
import { inspectionChanges } from "./inspectionChanges.ts";
import { inspectionReads } from "./inspectionReads.ts";

export function inspection(client: PgBossClient, schema = "pgboss"): Effect.Effect<PgBossInspectionService> {
	const engine = jobEngine(client, schema);
	return Effect.gen(function* () {
		const listings = yield* jobListings;
		const { getJob } = yield* jobControl;
		return {
			...inspectionReads(client, schema),
			...listings,
			changes: (queue?: { readonly name: string }) => inspectionChanges(client, schema, queue?.name),
			counts: (queue: { readonly name: string }) => countsFor(client, schema, queue.name),
			getJob,
			health: (queues: readonly { readonly name: string }[]) =>
				healthFor(
					client,
					queues.map((queue) => queue.name),
				),
		};
	}).pipe(Effect.provideService(JobEngine, engine));
}
