import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { EngineClient } from "@shivaedev/jobs/server/engineClient.ts";
import { testingOperation } from "#jobs/adapters/testingOperation.ts";
import { quotedSchema } from "#jobs/quotedSchema.ts";

export function testingDueNow(client: () => EngineClient, schema: () => string, changed: () => void) {
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
