import { type Context, Effect, type Scope } from "effect";
import type { Job, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { batchHandler } from "#internal/batchHandler.ts";
import { deferrableAttempt } from "#internal/deferrableAttempt.ts";
import { retryWake } from "#internal/retryWake.ts";
import { traceJob } from "#internal/tracing.ts";

export function registerWorker(
	client: PgBossClient,
	name: string,
	options: WorkOptions,
	run: (job: Job<unknown>) => Effect.Effect<unknown, unknown, unknown>,
	scope: Scope.Scope,
	schema: string,
	maxDeferrals: number,
	context: Context.Context<unknown>,
): Promise<string> {
	const registration = client.work(
		name,
		{ ...options, includeMetadata: true },
		batchHandler(
			client,
			name,
			(job) => {
				const attempt = traceJob(deferrableAttempt(run(job), client, schema, job, maxDeferrals), job, name);
				return Effect.provide(attempt, context);
			},
			(attempt) => Effect.runPromiseWith(context)(retryWake(client, name, attempt.id, registration).pipe(Effect.forkIn(scope), Effect.asVoid)),
			Effect.runPromiseWith(context),
		),
	);
	return registration;
}
