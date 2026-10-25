import { Data, Deferred, Duration, Effect, Option } from "effect";
import type { SendOptions } from "pg-boss";
import { vi } from "vitest";
import type { PgBossService } from "#service.ts";
import type { clientEngine } from "#test/clientEngine.ts";
import { pgBossRuntime } from "#test/pgBossRuntime.ts";
import type { testingEngine } from "#test/testingEngine.ts";

type TestingState = ReturnType<typeof testingEngine> extends Generator<unknown, infer A, never> ? A : never;
type JobPageOptions = Parameters<PgBossService["failedJobs"]>[1];
type State = ReturnType<typeof clientEngine> & { testingState: TestingState };

class WorkerRejected extends Data.TaggedError("WorkerRejected")<{ readonly id: number; readonly message: string }> {}

export function* testingProducer(state: State) {
	const testing = state.testingState;
	if (!testing.enabled) {
		return;
	}
	const runtime = yield* pgBossRuntime(state, () => undefined).boot([testing.queue, testing.followUps], {
		clientCacheKey: testing.clientCacheKey,
		clientFactory: (options) => {
			const client = testing.testing.clientFactory(options);
			testing.client = Option.some(client);
			return client;
		},
		schema: "story_jobs",
		supervise: false,
	});
	testing.jobs = Option.some(runtime.jobs);
}

export function* testingWorker(state: State) {
	const testing = state.testingState;
	if (!(testing.enabled && testing.worker)) {
		return;
	}
	const worker = testing.queue.handle(({ id }, job) => {
		testing.attempts.push(id);
		if (Option.isSome(testing.stuck)) {
			const activeWorker = Option.getOrThrow(testing.client)
				.getWipData?.()
				.find((candidate) => candidate.name === testing.queue.name);
			if (activeWorker !== undefined) {
				testing.workerIds.push(activeWorker.id);
			}
			return testing.stuck.value === "first" && testing.attempts.length > 1
				? Effect.void
				: Effect.never.pipe(
						Effect.onInterrupt(() => Effect.map(job.remainingBudget, (budget) => testing.interruptions.push(Duration.toMillis(budget)))),
					);
		}
		if (testing.paused) {
			return Deferred.succeed(testing.entered, undefined).pipe(Effect.andThen(Deferred.await(testing.release)));
		}
		return testing.recovered ? Effect.void : Effect.fail(new WorkerRejected({ id, message: "The worker fails this attempt" }));
	});
	const runtime = yield* pgBossRuntime(state, () => undefined).boot([worker, testing.followUps], {
		clientCacheKey: testing.clientCacheKey,
		clientFactory: testing.testing.clientFactory,
		schema: "story_jobs",
		supervise: false,
	});
	testing.jobs = Option.some(runtime.jobs);
}

export function testingVerbs(state: TestingState) {
	function jobs() {
		return Option.getOrThrow(state.jobs);
	}
	function recordIdleReads() {
		const db = Option.getOrThrow(state.client).getDb?.();
		if (db === undefined) {
			throw new Error("The testing client exposes its database");
		}
		const executeSql = vi.spyOn(db, "executeSql");
		return () => executeSql.mock.calls.flatMap(([text]) => (text.includes("effect-pg-boss testing idle") ? [text] : []));
	}
	return {
		attempts: state.attempts,
		deadLetteredJobs: (options: JobPageOptions) => jobs().deadLetteredJobs(state.queue, options),
		failedJobs: (options: JobPageOptions) => jobs().failedJobs(state.queue, options),
		followUps: state.followUps,
		interruptions: state.interruptions,
		queue: state.queue,
		recordIdleReads,
		recoverWorker: Effect.sync(() => {
			state.recovered = true;
		}),
		releaseWorker: Deferred.succeed(state.release, undefined),
		retry: (id: string) => jobs().retry(state.queue, id),
		send: (id: number, options?: SendOptions) => jobs().enqueue(state.queue, { id }, options),
		sendFollowUp: (note: string, options?: SendOptions) => jobs().enqueue(state.followUps, { note }, options),
		service: jobs,
		snapshot: Effect.suspend(() => state.testing.snapshot([state.queue, state.followUps])),
		testing: state.testing,
		testingClient: () => Option.getOrThrow(state.client),
		workerIds: state.workerIds,
		workerStarted: Deferred.await(state.entered),
	};
}
