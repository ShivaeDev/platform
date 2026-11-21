import { Cause, Clock, Deferred, Effect, Exit, Fiber } from "effect";
import { batchClockOffset, databaseNow } from "#server/adapters/batchClockOffset.ts";
import type { PgBossClient } from "#server/adapters/client.ts";
import { deadlineLogged, failureLogged } from "#server/attemptLog.ts";
import { deadlineOf, validateDeadline } from "#server/deadlineOf.ts";
import { deferredAttempt } from "#server/deferral.ts";
import { type PgBossError, toPgBossError } from "#server/error.ts";
import { failureOutput } from "#server/failureOutput.ts";
import type { WorkerJob } from "#server/job.ts";
import { waitForBatchExpiry } from "#server/waitForBatchExpiry.ts";

function settleAttempt(
	complete: NonNullable<PgBossClient["complete"]>,
	fail: NonNullable<PgBossClient["fail"]>,
	name: string,
	job: WorkerJob<unknown>,
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

const deadlineReached = Symbol("deadlineReached");

const interruptAt = Effect.fnUntraced(function* (deadline: number) {
	let remaining = deadline - (yield* Clock.currentTimeMillis);
	while (remaining > 0) {
		yield* Effect.sleep(remaining);
		remaining = deadline - (yield* Clock.currentTimeMillis);
	}
	return deadlineReached;
});

function attemptEnded(name: string, job: WorkerJob<unknown>, exit: Exit.Exit<unknown, unknown>): Effect.Effect<"deadline" | "interrupted" | "ended"> {
	if (Exit.isSuccess(exit) && exit.value === deadlineReached) {
		return Effect.as(deadlineLogged(name, job), "deadline");
	}
	if (job.signal.aborted || (Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause))) {
		return Effect.succeed("interrupted");
	}
	if (Exit.isFailure(exit)) {
		return Effect.as(failureLogged(name, job, exit.cause), "ended");
	}
	return Effect.succeed("ended");
}

function aborted(signal: AbortSignal) {
	return Effect.callback<void>((resume) => {
		function abort() {
			resume(Effect.void);
		}
		if (signal.aborted) {
			abort();
		} else {
			signal.addEventListener("abort", abort, { once: true });
		}
		return Effect.sync(() => signal.removeEventListener("abort", abort));
	});
}

export function batchHandler<R>(
	client: PgBossClient,
	name: string,
	schema: string,
	run: (job: WorkerJob<unknown>, deadline: number) => Effect.Effect<unknown, unknown, R>,
	afterRetry: (job: WorkerJob<unknown>) => Effect.Effect<void, unknown> = () => Effect.void,
) {
	const complete = client.complete?.bind(client);
	const fail = client.fail?.bind(client);
	if (complete === undefined || fail === undefined) {
		throw new TypeError("This pg-boss client does not support complete and fail");
	}
	// pg-boss aborts every signal of a batch when its own batch timeout fires, which can come before this handler's deadline timer.
	// So a job left to pg-boss is logged as timed out when its claim ends after its window has passed on PostgreSQL's clock.
	const deadlineWhenReleased = Effect.fnUntraced(function* (job: WorkerJob<unknown>, released: Deferred.Deferred<void>) {
		yield* aborted(job.signal).pipe(Effect.raceFirst(Deferred.await(released)));
		if ((yield* databaseNow(client, schema, name)) >= deadlineOf(job)) {
			yield* deadlineLogged(name, job);
		}
	}, Effect.catch(Effect.logError));
	const leftToExpiry = Effect.fnUntraced(function* (left: readonly WorkerJob<unknown>[], waitForExpiry: Effect.Effect<void, PgBossError>) {
		const released = yield* Deferred.make<void>();
		const watchers = yield* Effect.forEach(left, (job) => Effect.forkChild(deadlineWhenReleased(job, released)));
		const waited = yield* Effect.exit(waitForExpiry);
		yield* Deferred.succeed(released, undefined);
		yield* Fiber.joinAll(watchers);
		return yield* waited;
	});
	const handle = Effect.fnUntraced(function* (job: WorkerJob<unknown>, offset: number) {
		yield* validateDeadline(job);
		if (job.signal.aborted) {
			return "interrupted";
		}
		const deadline = deadlineOf(job) + offset;
		const remaining = deadline - (yield* Clock.currentTimeMillis);
		if (remaining <= 0) {
			yield* deadlineLogged(name, job);
			return "expired";
		}
		const exit = yield* run(job, deadline).pipe(
			Effect.raceFirst(interruptAt(deadline)),
			Effect.raceFirst(Effect.andThen(aborted(job.signal), Effect.interrupt)),
			Effect.exit,
		);
		const ended = yield* attemptEnded(name, job, exit);
		if (ended !== "ended") {
			return ended;
		}
		yield* settleAttempt(complete, fail, name, job, exit);
		if (Exit.isFailure(exit) || exit.value === deferredAttempt) {
			yield* afterRetry(job);
		}
		return "settled";
	});
	const handleAll = Effect.fnUntraced(function* (
		jobs: readonly WorkerJob<unknown>[],
		offset: number,
		waitForExpiry: Effect.Effect<void, PgBossError>,
	) {
		let expired = false;
		for (const [index, job] of jobs.entries()) {
			const outcome = yield* handle(job, offset);
			if (outcome === "deadline" || outcome === "interrupted") {
				return yield* leftToExpiry(jobs.slice(outcome === "deadline" ? index + 1 : index), waitForExpiry);
			}
			expired ||= outcome === "expired";
		}
		if (expired) {
			yield* waitForExpiry;
		}
	});
	return (jobs: readonly WorkerJob<unknown>[]) =>
		Effect.gen(function* () {
			const offset = yield* batchClockOffset(client, schema, name);
			for (const job of jobs) {
				yield* validateDeadline(job);
			}
			const deadline = Math.max(...jobs.map((job) => deadlineOf(job) + offset));
			const waitForExpiry = waitForBatchExpiry(client, name, jobs, deadline).pipe(Effect.tapError(Effect.logError));
			yield* handleAll(jobs, offset, waitForExpiry);
		});
}
