import { Cause, Clock, Effect, Exit } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { deadlineOf } from "#internal/deadlineOf.ts";
import { deferredAttempt } from "#internal/deferral.ts";
import { waitForBatchExpiry } from "#internal/waitForBatchExpiry.ts";

function failureOutput(cause: Cause.Cause<unknown>): object {
	const error = Cause.squash(cause);
	return typeof error === "object" && error !== null ? error : { message: String(error) };
}

async function settleAttempt(
	complete: NonNullable<PgBossClient["complete"]>,
	fail: NonNullable<PgBossClient["fail"]>,
	name: string,
	job: Job<unknown>,
	exit: Exit.Exit<unknown, unknown>,
	afterFailure?: (job: Job<unknown>) => Promise<void>,
) {
	if (Exit.isSuccess(exit)) {
		if (exit.value !== deferredAttempt) {
			await complete(name, job);
		}
	} else {
		await fail(name, job, failureOutput(exit.cause));
		await afterFailure?.(job);
	}
}

export function batchHandler(
	client: PgBossClient,
	name: string,
	run: (job: Job<unknown>) => Effect.Effect<unknown, unknown>,
	afterFailure?: (job: Job<unknown>) => Promise<void>,
) {
	const complete = client.complete?.bind(client);
	const fail = client.fail?.bind(client);
	if (complete === undefined || fail === undefined) {
		throw new TypeError("This pg-boss client does not support complete and fail");
	}

	return async (jobs: readonly Job<unknown>[]): Promise<void> => {
		let expired = false;
		for (const job of jobs) {
			const deadline = deadlineOf(job);
			if ((await Effect.runPromise(Clock.currentTimeMillis)) >= deadline) {
				expired = true;
				continue;
			}
			const exit = await Effect.runPromiseExit(
				Effect.flatMap(Clock.currentTimeMillis, (now) => {
					const remaining = deadline - now;
					return remaining <= 0 ? Effect.interrupt : run(job).pipe(Effect.timeoutOrElse({ duration: remaining, orElse: () => Effect.interrupt }));
				}),
				{ signal: job.signal },
			);
			if (job.signal.aborted || (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause))) {
				return waitForBatchExpiry(client, name, jobs);
			}
			await settleAttempt(complete, fail, name, job, exit, afterFailure);
		}
		if (expired) {
			return waitForBatchExpiry(client, name, jobs);
		}
	};
}
