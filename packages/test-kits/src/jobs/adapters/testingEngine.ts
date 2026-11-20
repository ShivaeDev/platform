import { Effect, Redacted } from "effect";
import type { EngineClient } from "@shivaedev/jobs/server/engineClient.ts";
import { expireAttempt } from "#jobs/adapters/expireAttempt.ts";
import { PgBossTestingError } from "#jobs/error.ts";

export function testingEngine(client: EngineClient, schema: string) {
	return {
		expireAttempt: (job: Parameters<typeof expireAttempt>[2], cause?: "expiry" | "heartbeat") =>
			Effect.tryPromise({
				catch: (original) => new PgBossTestingError({ operation: "expireAttempt", original: Redacted.make(original), queue: job.name }),
				try: () => expireAttempt(client, schema, job, cause),
			}),
	};
}
