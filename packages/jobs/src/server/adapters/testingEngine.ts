import { type Context, Effect, Redacted } from "effect";
import type { PgBoss } from "pg-boss";
import { PgBossTestingError } from "#server/error.ts";
import type { TestingEngine } from "#server/internal/engine.ts";
import { expireAttempt } from "./expireAttempt.ts";
import { observeTestingSettlements } from "./observeTestingSettlements.ts";

export function testingEngine(client: PgBoss, schema: string): Context.Service.Shape<typeof TestingEngine> {
	return {
		expireAttempt: (job, cause) =>
			Effect.tryPromise({
				catch: (original) => new PgBossTestingError({ operation: "expireAttempt", original: Redacted.make(original), queue: job.name }),
				try: () => expireAttempt(client, schema, job, cause),
			}),
		observeSettlements: (settled) =>
			Effect.sync(() => {
				const observer = observeTestingSettlements(client, settled);
				return {
					close: Effect.sync(() => observer.close()),
					watch: (name: string) =>
						Effect.try({
							catch: (original) => new PgBossTestingError({ operation: "observeSettlements", original: Redacted.make(original), queue: name }),
							try: () => observer.watch(name),
						}),
				};
			}),
	};
}
