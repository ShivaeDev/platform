import { Cause, Clock, Effect, Exit } from "effect";
import type { Job } from "pg-boss";
import type { PgBossClient } from "#client.ts";
import { toPgBossError } from "#error.ts";
import { deadlineOf } from "#internal/deadlineOf.ts";
import { deferredAttempt } from "#internal/deferral.ts";
import { failureOutput } from "#internal/failureOutput.ts";
import { waitForBatchExpiry } from "#internal/waitForBatchExpiry.ts";

function settleAttempt(
	complete: NonNullable<PgBossClient["complete"]>,
	fail: NonNullable<PgBossClient["fail"]>,
	name: string,
	job: Job<unknown>,
	exit: Exit.Exit<unknown, unknown>,
) {
	if (Exit.isSuccess(exit) && exit.value === deferredAttempt) {
		return Effect.void;
	}
	return Effect.tryPromise({
		catch: (error) => toPgBossError("settle", error, name),
		try: () => (Exit.isSuccess(exit) ? complete(name, job) : fail(name, job, failureOutput(exit.cause))),
	});
}

export type PgBossRunner = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;

function aborted(signal: AbortSignal) {
	return Effect.callback<never>((resume) => {
		function interrupt() {
			resume(Effect.interrupt);
		}
		if (signal.aborted) {
			interrupt();
		} else {
			signal.addEventListener("abort", interrupt, { once: true });
		}
		return Effect.sync(() => signal.removeEventListener("abort", interrupt));
	});
}

export function batchHandler(
	client: PgBossClient,
	name: string,
	run: (job: Job<unknown>) => Effect.Effect<unknown, unknown>,
	afterFailure: (job: Job<unknown>) => Effect.Effect<void, unknown> = () => Effect.void,
) {
	const complete = client.complete?.bind(client);
	const fail = client.fail?.bind(client);
	if (complete === undefined || fail === undefined) {
		throw new TypeError("This pg-boss client does not support complete and fail");
	}
	const handle = Effect.fnUntraced(function* (job: Job<unknown>) {
		if (job.signal.aborted) {
			return "interrupted";
		}
		const remaining = deadlineOf(job) - (yield* Clock.currentTimeMillis);
		if (remaining <= 0) {
			return "expired";
		}
		const exit = yield* run(job).pipe(
			Effect.timeoutOrElse({ duration: remaining, orElse: () => Effect.interrupt }),
			Effect.raceFirst(aborted(job.signal)),
			Effect.exit,
		);
		if (job.signal.aborted || (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause))) {
			return "interrupted";
		}
		yield* settleAttempt(complete, fail, name, job, exit);
		if (Exit.isFailure(exit)) {
			yield* afterFailure(job);
		}
		return "settled";
	});
	return (jobs: readonly Job<unknown>[]) =>
		Effect.gen(function* () {
			const waitForExpiry = waitForBatchExpiry(client, name, jobs).pipe(Effect.tapError(Effect.logError));
			let expired = false;
			for (const job of jobs) {
				const outcome = yield* handle(job);
				if (outcome === "interrupted") {
					return yield* waitForExpiry;
				}
				expired ||= outcome === "expired";
			}
			if (expired) {
				yield* waitForExpiry;
			}
		});
}
