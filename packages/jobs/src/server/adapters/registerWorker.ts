import { Effect, Fiber, Scope } from "effect";
import { batchHandler } from "#server/adapters/batchHandler.ts";
import type { PgBossClient } from "#server/client.ts";
import type { StopOptions } from "#server/clientOptions.ts";
import { deferrableAttempt } from "#server/deferrableAttempt.ts";
import { JobEngine } from "#server/engine.ts";
import { toPgBossError } from "#server/error.ts";
import type { WorkerJob } from "#server/job.ts";
import { retryWake } from "#server/retryWake.ts";
import { traceJob } from "#server/tracing.ts";
import type { WorkerOptions } from "#server/workerOptions.ts";
import { jobEngine } from "./jobEngine.ts";

export const registerWorker = Effect.fnUntraced(function* <R>(
	client: PgBossClient,
	name: string,
	options: WorkerOptions,
	run: (job: WorkerJob<unknown>, deadline: number) => Effect.Effect<unknown, unknown, R>,
	schema: string,
	maxDeferrals: number,
	stop?: StopOptions,
) {
	const scope = yield* Effect.scope;
	const execute = Effect.runPromiseWith(yield* Effect.context<R>());
	const workerScope = yield* Scope.fork(scope);
	const fibers = yield* Scope.fork(workerScope);
	const engine = jobEngine(client, schema);
	function runJob(job: WorkerJob<unknown>, deadline: number) {
		return traceJob(deferrableAttempt(run(job, deadline), job, maxDeferrals).pipe(Effect.provideService(JobEngine, engine)), job, name);
	}
	function afterRetry(attempt: WorkerJob<unknown>) {
		return retryWake(client, schema, name, attempt.id, registration).pipe(Effect.forkIn(fibers), Effect.asVoid);
	}
	const handle = yield* Effect.try({
		catch: (error) => toPgBossError("register", error, name),
		try: () => {
			const unsupported = (["perJobResults", "transactional"] as const).filter((mode) => options[mode] === true);
			if (unsupported.length > 0) {
				throw new TypeError(`Unsupported worker callback modes: ${unsupported.join(", ")}. Omit these options or set them to false.`);
			}
			return batchHandler(client, name, schema, runJob, afterRetry);
		},
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
