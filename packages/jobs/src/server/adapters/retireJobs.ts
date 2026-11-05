import { Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import type { JobRegistration } from "#server/definition.ts";
import { toPgBossError } from "#server/error.ts";
import { deadLetterQueueName } from "#server/health.ts";
import { registrationNames } from "#server/register.ts";

export const retireJobs = Effect.fnUntraced(function* (client: PgBossClient, jobs: readonly JobRegistration[], retired: readonly string[]) {
	yield* Effect.try({
		catch: (error) => toPgBossError("register", error),
		try: () => {
			const active = registrationNames(jobs).flatMap((name) => [name, deadLetterQueueName(name)]);
			if (retired.some((name) => active.includes(name))) {
				throw new TypeError("Retired queues must not be registered or used as dead-letter queues");
			}
		},
	});
	for (const name of retired) {
		yield* Effect.tryPromise({
			catch: (error) => toPgBossError("register", error, name),
			try: async () => {
				if (client.deleteQueue === undefined) {
					throw new TypeError("This pg-boss client does not support deleteQueue");
				}
				await client.offWork(name);
				await client.deleteQueue(name);
			},
		});
	}
});
