import { Clock, type Context, Effect, type Scope } from "effect";
import type { Job, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { batchHandler } from "#internal/batchHandler.ts";
import { deferrableAttempt } from "#internal/deferrableAttempt.ts";
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
			async (attempt) => {
				if (client.findJobs === undefined || client.notifyWorker === undefined) {
					return;
				}
				const job = (await client.findJobs(name, { id: attempt.id }))[0];
				if (job?.state !== "retry") {
					return;
				}
				const workId = await registration;
				await Effect.runPromise(
					Effect.gen(function* () {
						const now = yield* Clock.currentTimeMillis;
						// PostgreSQL timestamps retain sub-millisecond precision that Date drops.
						yield* Effect.sleep(Math.max(0, job.startAfter.getTime() + 1 - now));
						const workerIds = client
							.getWipData?.()
							.filter((worker) => worker.workId === workId)
							.map((worker) => worker.id) ?? [workId];
						for (const workerId of workerIds) {
							client.notifyWorker?.(workerId);
						}
					}).pipe(Effect.forkIn(scope)),
				);
			},
		),
	);
	return registration;
}
