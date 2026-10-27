import { Effect } from "effect";
import type { JobWithMetadata } from "pg-boss";
import { auditQueue, issueQueue } from "#test/fixture.ts";
import type { InboxState } from "#test/host.ts";

export function queueVerbs(state: InboxState) {
	function client() {
		if (state.client === undefined) {
			throw new Error("The host has not started its jobs client");
		}
		return state.client;
	}
	return {
		allowAudit: () => Effect.tryPromise(() => client().createQueue(auditQueue.name, auditQueue.queueOptions)),
		rejectAudit: () => Effect.tryPromise(() => client().deleteQueue(auditQueue.name)),
		storedJobs: () =>
			Effect.tryPromise(async () => {
				const jobs: JobWithMetadata<unknown>[] = [];
				for (const queue of [issueQueue, auditQueue]) {
					if ((await client().getQueue(queue.name)) !== null) {
						jobs.push(...(await client().findJobs(queue.name)));
					}
				}
				return jobs.toSorted((a, b) => a.name.localeCompare(b.name));
			}),
	};
}
