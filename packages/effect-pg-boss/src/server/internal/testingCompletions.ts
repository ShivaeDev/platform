import { Effect } from "effect";
import type { JobAttempt } from "pg-boss";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";

export function testingCompletions() {
	const completed = new Map<string, Map<string, JobAttempt>>();
	return {
		acknowledge(name: string, attempts: string | string[] | JobAttempt | JobAttempt[], response: object) {
			if (!("settled" in response && Array.isArray(response.settled))) {
				throw new TypeError("The testing client requires pg-boss completion acknowledgements");
			}
			const settled = new Set<unknown>(response.settled);
			const jobs = completed.get(name) ?? new Map<string, JobAttempt>();
			for (const attempt of Array.isArray(attempts) ? attempts : [attempts]) {
				if (typeof attempt !== "string" && settled.has(attempt.id)) {
					jobs.set(attempt.id, { id: attempt.id, retryCount: attempt.retryCount });
				}
			}
			completed.set(name, jobs);
		},
		read: <TName extends string, TPayload extends JobPayloadSchema>(queue: QueueDefinition<TName, TPayload>): Effect.Effect<readonly JobAttempt[]> =>
			Effect.sync(() => [...(completed.get(queue.name)?.values() ?? [])].map((attempt) => ({ ...attempt }))),
	};
}
