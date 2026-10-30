import { Effect, Schedule } from "effect";
import type { Queue } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { PgBossQueueOptionsError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";

const DEADLOCK_DETECTED = "40P01";
const CREATE_QUEUE_ATTEMPTS = 6;

// A partitioned queue attaches its table to pg-boss's job table, which can deadlock with job traffic on other queues.
// PostgreSQL rolls the whole creation back, so trying it again is safe.
function createQueue(client: PgBossClient, name: string, options?: Omit<Queue, "name">) {
	return Effect.tryPromise({ catch: (error) => error, try: () => client.createQueue(name, options) }).pipe(
		Effect.retry({
			schedule: Schedule.exponential(25).pipe(Schedule.upTo({ times: CREATE_QUEUE_ATTEMPTS - 1 })),
			while: (error) => error instanceof Error && Reflect.get(error, "code") === DEADLOCK_DETECTED,
		}),
	);
}

export const ensureQueue = Effect.fnUntraced(function* (client: PgBossClient, name: string, options: Omit<Queue, "name" | "deadLetter">) {
	const deadLetter = deadLetterQueueName(name);
	const desired = { retryBackoff: true, retryLimit: 3, ...options, deadLetter };
	yield* createQueue(client, deadLetter);
	yield* createQueue(client, name, desired);
	const existing = yield* Effect.tryPromise({ catch: (error) => error, try: () => client.getQueue(name) });
	if (existing === null) {
		return;
	}
	const immutable = (["partition", "policy"] as const).filter((key) => desired[key] !== undefined && desired[key] !== existing[key]);
	if (immutable.length > 0) {
		return yield* new PgBossQueueOptionsError({ options: immutable, queue: name });
	}
	const updateQueue = client.updateQueue?.bind(client);
	const { partition: _partition, policy: _policy, ...mutable } = desired;
	const changed = Object.entries(mutable).some(([key, value]) => value !== undefined && value !== Reflect.get(existing, key));
	if (!changed) {
		return;
	}
	if (updateQueue === undefined) {
		return yield* Effect.fail(new TypeError("This pg-boss client does not support updateQueue"));
	}
	// pg-boss validates retryDelayMax against retryBackoff in the same update.
	yield* Effect.tryPromise({ catch: (error) => error, try: () => updateQueue(name, mutable) });
});
