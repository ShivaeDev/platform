import { DateTime, Effect } from "effect";
import type { PgBossClient } from "#server/adapters/client.ts";
import { inspectionJobs } from "#server/adapters/inspectionJobs.ts";
import { deferralOf } from "#server/deferral.ts";
import type { QueueDefinition } from "#server/definition.ts";

export function inspectionDeferrals(client: PgBossClient) {
	const { storedJobs } = inspectionJobs(client);
	return {
		deferred: (queue: Pick<QueueDefinition, "name">) =>
			storedJobs(queue).pipe(
				Effect.map((jobs) =>
					jobs.flatMap((job) => {
						const deferral = job.state === "retry" && job.startedOn === null ? deferralOf(job) : undefined;
						return deferral === undefined ? [] : [{ at: DateTime.makeUnsafe(job.startAfter), reason: deferral.reason }];
					}),
				),
			),
	};
}
