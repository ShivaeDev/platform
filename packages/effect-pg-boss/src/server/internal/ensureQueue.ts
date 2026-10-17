import type { Queue } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { PgBossQueueOptionsError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";

export async function ensureQueue(client: PgBossClient, name: string, options: Omit<Queue, "name" | "deadLetter">): Promise<void> {
	const deadLetter = deadLetterQueueName(name);
	const desired = { retryBackoff: true, retryLimit: 3, ...options, deadLetter };
	await client.createQueue(deadLetter);
	await client.createQueue(name, desired);
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
