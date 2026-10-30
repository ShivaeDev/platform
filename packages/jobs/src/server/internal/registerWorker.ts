import { type Context, Effect, Fiber, Scope } from "effect";
import type { Job, WorkOptions } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { batchHandler, type PgBossRunner } from "#internal/batchHandler.ts";
import { deferrableAttempt } from "#internal/deferrableAttempt.ts";
import { retryWake } from "#internal/retryWake.ts";
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
	function afterFailure(attempt: Job<unknown>) {
		return retryWake(client, name, attempt.id, registration).pipe(Effect.forkIn(fibers), Effect.asVoid);
	}
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
