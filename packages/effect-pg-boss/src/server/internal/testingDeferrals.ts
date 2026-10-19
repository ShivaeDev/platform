import { DateTime } from "effect";
import type { PgBoss } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { deferralOf } from "#internal/deferral.ts";
import { quotedSchema } from "#internal/storedRows.ts";
import { testingOperation } from "#internal/testingReadout.ts";

export function testingDeferrals(client: () => PgBoss, schema: () => string, changed: () => void) {
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
		runDeferredNow: (queue: Pick<QueueDefinition, "name">) =>
			testingOperation(
				"runDeferredNow",
				async () => {
					const quoted = quotedSchema(schema());
					await client()
						.getDb()
						.executeSql(
							`UPDATE ${quoted}.job SET start_after = ${quoted}.job_now()
				WHERE name = $1 AND state = 'retry' AND output ? 'jobDeferral' AND started_on IS NULL`,
							[queue.name],
						);
					changed();
					for (const worker of client()
						.getWipData()
						.filter((candidate) => candidate.name === queue.name)) {
						client().notifyWorker(worker.id);
					}
				},
				queue.name,
			),
	};
}
