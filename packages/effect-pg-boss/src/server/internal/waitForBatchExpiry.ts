import { setTimeout } from "node:timers/promises";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";

export async function waitForBatchExpiry(client: PgBossClient, name: string, jobs: readonly Job<unknown>[]): Promise<void> {
	if (client.findJobs === undefined) {
		throw new TypeError("This pg-boss client does not support reading interrupted claims");
	}
	for (const job of jobs) {
		while (true) {
			const current = (await client.findJobs(name, { id: job.id }))[0];
			if (current?.state !== "active" || current.retryCount !== job.retryCount) {
				break;
			}
			// Aborting the signal precedes pg-boss's failure write; returning early would complete this claim.
			await setTimeout(25);
		}
	}
}
