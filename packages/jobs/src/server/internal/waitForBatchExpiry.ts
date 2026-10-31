import { Clock, Effect } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { type PgBossError, toPgBossError } from "#error.ts";

export function waitForBatchExpiry(
	client: PgBossClient,
	name: string,
	jobs: readonly Job<unknown>[],
	deadline: number,
): Effect.Effect<void, PgBossError> {
	return Effect.gen(function* () {
		const findJobs = client.findJobs?.bind(client);
		if (findJobs === undefined) {
			return yield* Effect.fail(new TypeError("This pg-boss client does not support reading interrupted claims"));
		}
		let delay = 25;
		const poll = Effect.gen(function* () {
			for (const job of jobs) {
				while (true) {
					const current = (yield* Effect.tryPromise({ catch: (error) => error, try: () => findJobs(name, { id: job.id }) }))[0];
					if (current?.state !== "active" || current.retryCount !== job.retryCount) {
						break;
					}
					// Aborting the signal precedes pg-boss's failure write; returning early would complete this claim.
					yield* Effect.sleep(delay);
					delay = Math.min(delay * 2, 500);
				}
			}
		});
		return yield* poll.pipe(Effect.timeout(Math.max(0, deadline + 1000 - (yield* Clock.currentTimeMillis))));
	}).pipe(Effect.mapError((error) => toPgBossError("settle", error, name)));
}
