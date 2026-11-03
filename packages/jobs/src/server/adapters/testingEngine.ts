import { type Context, Effect, Redacted } from "effect";
import type { EngineClient } from "#server/engineClient.ts";
import { PgBossTestingError } from "#server/error.ts";
import type { TestingEngine } from "#server/internal/engine.ts";
import { expireAttempt } from "./expireAttempt.ts";

export function testingEngine(client: EngineClient, schema: string): Context.Service.Shape<typeof TestingEngine> {
	return {
		expireAttempt: (job, cause) =>
			Effect.tryPromise({
				catch: (original) => new PgBossTestingError({ operation: "expireAttempt", original: Redacted.make(original), queue: job.name }),
				try: () => expireAttempt(client, schema, job, cause),
			}),
	};
}
