import type { Queue } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { PgBossQueueOptionsError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";

const DEADLOCK_DETECTED = "40P01";
const CREATE_QUEUE_ATTEMPTS = 6;

// A partitioned queue attaches its table to pg-boss's job table, which can deadlock with job traffic on other queues.
// PostgreSQL rolls the whole creation back, so trying it again is safe.
async function createQueue(client: PgBossClient, name: string, options?: Omit<Queue, "name">): Promise<void> {
	for (let attempt = 1; ; attempt += 1) {
		try {
			return await client.createQueue(name, options);
		} catch (error) {
			if (attempt === CREATE_QUEUE_ATTEMPTS || !(error instanceof Error) || Reflect.get(error, "code") !== DEADLOCK_DETECTED) {
				throw error;
			}
			await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** (attempt - 1)));
		}
	}
}

export async function ensureQueue(client: PgBossClient, name: string, options: Omit<Queue, "name" | "deadLetter">): Promise<void> {
	const deadLetter = deadLetterQueueName(name);
	const desired = { retryBackoff: true, retryLimit: 3, ...options, deadLetter };
	await createQueue(client, deadLetter);
	await createQueue(client, name, desired);
	const existing = await client.getQueue(name);
	if (existing === null) {
		return;
	}
	const immutable = (["partition", "policy"] as const).filter((key) => desired[key] !== undefined && desired[key] !== existing[key]);
	if (immutable.length > 0) {
		throw new PgBossQueueOptionsError({ options: immutable, queue: name });
	}
	const { partition: _partition, policy: _policy, ...mutable } = desired;
	const changed = Object.entries(mutable).some(([key, value]) => value !== undefined && value !== Reflect.get(existing, key));
	if (!changed) {
		return;
	}
	if (client.updateQueue === undefined) {
		throw new TypeError("This pg-boss client does not support updateQueue");
	}
	// pg-boss validates retryDelayMax against retryBackoff in the same update.
	await client.updateQueue(name, mutable);
}
