import { DateTime } from "effect";
import type { PgBoss } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { deferralOf } from "#internal/deferral.ts";
import { testingOperation } from "#internal/testingReadout.ts";

export function testingDeferrals(client: () => PgBoss) {
	return {
		deferred: (queue: Pick<QueueDefinition, "name">) =>
			testingOperation(
				"deferred",
				async () => {
					const jobs = await client().findJobs(queue.name);
					return jobs.flatMap((job) => {
						const deferral = job.state === "retry" && job.startedOn === null ? deferralOf(job) : undefined;
						return deferral === undefined ? [] : [{ at: DateTime.makeUnsafe(job.startAfter), reason: deferral.reason }];
					});
				},
				queue.name,
			),
	};
}
