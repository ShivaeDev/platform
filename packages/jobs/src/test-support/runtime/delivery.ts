import { Clock, Effect } from "effect";
import type { Job } from "pg-boss";
import { failureOf } from "#test/failureOf.ts";
import type { Fetched, RuntimeEngine } from "./engine.ts";

export const finished = Effect.fnUntraced(function* (engine: RuntimeEngine) {
	for (const pending of engine.pending.splice(0)) {
		yield* pending;
	}
});

export const delivered = Effect.fnUntraced(function* (
	engine: RuntimeEngine,
	queue: string,
	jobs: readonly Fetched[],
	pgBossAborts: string | undefined,
) {
	const worker = engine.client.workers.findLast((entry) => entry.name === queue);
	if (worker === undefined) {
		return yield* Effect.die(new Error(`No worker is registered for ${queue}`));
	}
	const now = yield* Clock.currentTimeMillis;
	engine.client.databaseNow = now;
	const aborts = new Map(jobs.map((job) => [job.id, new AbortController()]));
	const batch = jobs.map((job): Job<unknown> & { readonly startedOn: Date } => ({
		data: job.data ?? {},
		expireInSeconds: job.expireInSeconds ?? 900,
		heartbeatSeconds: null,
		id: job.id,
		name: queue,
		retryCount: job.retryCount ?? 0,
		signal: aborts.get(job.id)?.signal ?? new AbortController().signal,
		startedOn: new Date(now - (job.startedMillisAgo ?? 0)),
	}));
	function abort() {
		if (pgBossAborts !== undefined && engine.work.started.some((attempt) => attempt.id === pgBossAborts)) {
			engine.work.changed.delete(abort);
			aborts.get(pgBossAborts)?.abort();
		}
	}
	engine.work.changed.add(abort);
	engine.batchAnswer = yield* Effect.tryPromise(() => worker.run(batch)).pipe(
		Effect.match({
			onFailure: (error) => {
				engine.batchFailureMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
				return `rejected with ${failureOf(error.cause)}`;
			},
			onSuccess: () => "returned",
		}),
		Effect.ensuring(Effect.sync(() => engine.work.changed.delete(abort))),
	);
	const deadline = Math.max(...batch.map((job) => job.startedOn.getTime() + job.expireInSeconds * 1000));
	engine.returnedAfterDeadline = (yield* Clock.currentTimeMillis) - deadline;
});
