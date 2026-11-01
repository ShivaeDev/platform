import type { PgBoss } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { quotedSchema } from "#internal/storedRows.ts";
import { testingOperation } from "#internal/testingReadout.ts";

export function testingDueNow(client: () => PgBoss, schema: () => string, changed: () => void) {
	function makeDue(queue: Pick<QueueDefinition, "name">, deferredOnly: boolean) {
		return testingOperation(
			deferredOnly ? "runDeferredNow" : "runDueNow",
			async () => {
				const quoted = quotedSchema(schema());
				const condition = deferredOnly
					? "state = 'retry' AND output ? 'jobDeferral' AND started_on IS NULL"
					: `state IN ('created', 'retry') AND start_after > ${quoted}.job_now()`;
				await client()
					.getDb()
					.executeSql(`UPDATE ${quoted}.job SET start_after = ${quoted}.job_now() WHERE name = $1 AND ${condition}`, [queue.name]);
				changed();
				for (const worker of client()
					.getWipData()
					.filter((candidate) => candidate.name === queue.name)) {
					client().notifyWorker(worker.id);
				}
			},
			queue.name,
		);
	}
	return {
		runDeferredNow: (queue: Pick<QueueDefinition, "name">) => makeDue(queue, true),
		runDueNow: (queue: Pick<QueueDefinition, "name">) => makeDue(queue, false),
	};
}
