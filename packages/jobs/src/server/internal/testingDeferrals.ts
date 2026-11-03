import { DateTime } from "effect";
import type { QueueDefinition } from "#server/definition.ts";
import type { EngineClient } from "#server/engineClient.ts";
import { deferralOf } from "#server/internal/deferral.ts";
import { testingOperation } from "#server/internal/testingReadout.ts";

export function testingDeferrals(client: () => EngineClient) {
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
