import { Clock, type Context, Effect, Fiber, type Scope } from "effect";
import type { Job, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { batchHandler, type PgBossRunner } from "#internal/batchHandler.ts";
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
	execute: PgBossRunner,
): Promise<string> {
	const handle = batchHandler(
		client,
		name,
		(job) => Effect.provide(traceJob(deferrableAttempt(run(job), client, schema, job, maxDeferrals), job, name), context),
		(attempt) =>
			Effect.gen(function* () {
				if (client.findJobs === undefined || client.notifyWorker === undefined) {
					return;
				}
				const findJobs = client.findJobs.bind(client);
				const job = (yield* Effect.tryPromise({ catch: (error) => error, try: () => findJobs(name, { id: attempt.id }) }))[0];
				if (job?.state !== "retry") {
					return;
				}
				const workId = yield* Effect.promise(() => registration);
				yield* Effect.gen(function* () {
					const deadline = job.startAfter.getTime() + 1;
					let remaining = deadline - (yield* Clock.currentTimeMillis);
					while (remaining > 0) {
						yield* Effect.sleep(remaining);
						remaining = deadline - (yield* Clock.currentTimeMillis);
					}
					const workerIds = client
						.getWipData?.()
						.filter((worker) => worker.workId === workId)
						.map((worker) => worker.id) ?? [workId];
					for (const workerId of workerIds) {
						client.notifyWorker?.(workerId);
					}
				}).pipe(Effect.forkIn(scope));
			}),
	);
	const registration = client.work(name, { ...options, includeMetadata: true }, (jobs) =>
		execute(handle(jobs).pipe(Effect.forkIn(scope), Effect.flatMap(Fiber.join))),
	);
	return registration;
}
