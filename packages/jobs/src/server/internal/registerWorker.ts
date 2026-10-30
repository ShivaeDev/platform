import { Clock, type Context, Effect, Fiber, Scope } from "effect";
import type { Job, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { batchHandler, type PgBossRunner } from "#internal/batchHandler.ts";
import { deferrableAttempt } from "#internal/deferrableAttempt.ts";
import { traceJob } from "#internal/tracing.ts";

export const registerWorker = Effect.fnUntraced(function* (
	client: PgBossClient,
	name: string,
	options: WorkOptions,
	run: (job: Job<unknown>) => Effect.Effect<unknown, unknown, unknown>,
	scope: Scope.Scope,
	schema: string,
	maxDeferrals: number,
	context: Context.Context<unknown>,
	execute: PgBossRunner,
	graceful: boolean,
) {
	const fibers = yield* Scope.fork(scope);
	function runJob(job: Job<unknown>) {
		return Effect.provide(traceJob(deferrableAttempt(run(job), client, schema, job, maxDeferrals), job, name), context);
	}
	const afterFailure = Effect.fnUntraced(function* (attempt: Job<unknown>) {
		if (client.findJobs === undefined || client.notifyWorker === undefined) {
			return;
		}
		const findJobs = client.findJobs.bind(client);
		const job = (yield* Effect.tryPromise({
			catch: (error) => toPgBossError("settle", error, name),
			try: () => findJobs(name, { id: attempt.id }),
		}))[0];
		if (job?.state !== "retry") {
			return;
		}
		const workId = yield* Effect.tryPromise({ catch: (error) => toPgBossError("register", error, name), try: () => registration });
		yield* Effect.gen(function* () {
			// Host timers can fire early; PostgreSQL also retains precision that Date drops.
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
		}).pipe(Effect.forkIn(fibers));
	});
	const handle = yield* Effect.try({
		catch: (error) => toPgBossError("register", error, name),
		try: () => batchHandler(client, name, runJob, afterFailure),
	});
	const registration: Promise<string> = yield* Effect.try({
		catch: (error) => toPgBossError("register", error, name),
		try: () =>
			client.work(name, { ...options, includeMetadata: true }, (jobs) =>
				execute(handle(jobs).pipe(Effect.forkIn(fibers), Effect.flatMap(Fiber.join))),
			),
	});
	const id = yield* Effect.tryPromise({ catch: (error) => toPgBossError("register", error, name), try: () => registration });
	yield* Scope.addFinalizer(
		scope,
		Effect.tryPromise({
			catch: (error) => toPgBossError("stop", error, name),
			try: () => client.offWork(name, { id, wait: graceful }),
		}).pipe(Effect.catch(Effect.logError)),
	);
	return id;
});
