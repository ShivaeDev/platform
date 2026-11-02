import { Effect, Fiber, Scope } from "effect";
import type { Job, StopOptions, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { batchHandler } from "#internal/batchHandler.ts";
import { deferrableAttempt } from "#internal/deferrableAttempt.ts";
import { retryWake } from "#internal/retryWake.ts";
import { traceJob } from "#internal/tracing.ts";

export const registerWorker = Effect.fnUntraced(function* <R>(
	client: PgBossClient,
	name: string,
	options: WorkOptions,
	run: (job: Job<unknown>, deadline: number) => Effect.Effect<unknown, unknown, R>,
	scope: Scope.Scope,
	schema: string,
	maxDeferrals: number,
	stop?: StopOptions,
) {
	const execute = Effect.runPromiseWith(yield* Effect.context<R>());
	const workerScope = yield* Scope.fork(scope);
	const fibers = yield* Scope.fork(workerScope);
	function runJob(job: Job<unknown>, deadline: number) {
		return traceJob(deferrableAttempt(run(job, deadline), client, schema, job, maxDeferrals), job, name);
	}
	function afterRetry(attempt: Job<unknown>) {
		return retryWake(client, schema, name, attempt.id, registration).pipe(Effect.forkIn(fibers), Effect.asVoid);
	}
	const handle = yield* Effect.try({
		catch: (error) => toPgBossError("register", error, name),
		try: () => batchHandler(client, name, schema, runJob, afterRetry),
	});
	const registration: Promise<string> = yield* Effect.try({
		catch: (error) => toPgBossError("register", error, name),
		try: () =>
			client.work(name, { ...options, includeMetadata: true }, (jobs) =>
				execute(handle(jobs).pipe(Effect.forkIn(fibers), Effect.flatMap(Fiber.join))),
			),
	});
	const id = yield* Effect.tryPromise({ catch: (error) => toPgBossError("register", error, name), try: () => registration });
	const graceful = stop?.graceful !== false;
	const timeout = stop?.timeout ?? 30_000;
	const drain = Effect.tryPromise({
		catch: (error) => toPgBossError("stop", error, name),
		try: () => client.offWork(name, { id, wait: graceful }),
	});
	yield* Scope.addFinalizer(
		workerScope,
		(graceful
			? drain.pipe(
					Effect.timeoutOrElse({
						duration: timeout,
						orElse: () => Effect.logWarning(`pg-boss worker drain timed out for queue ${name} after ${timeout}ms; interrupting in-flight work`),
					}),
					Effect.interruptible,
				)
			: drain
		).pipe(Effect.catch(Effect.logError)),
	);
	return id;
});
