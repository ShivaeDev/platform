import { type Context, DateTime, Effect, Option } from "effect";
import type { PgBossError, PgBossPayloadError } from "@shivaedev/effect-pg-boss/server/error.ts";
import type { PgBossService } from "@shivaedev/effect-pg-boss/server/service.ts";
import type { jobsPage } from "#jobs/page.ts";
import { JobsPayloadInvalid, type JobsQueue, JobsQueueUnregistered, JobsUnavailable } from "#jobs/schemas.ts";

function failures<A, R>(effect: Effect.Effect<A, PgBossError | PgBossPayloadError, R>) {
	return effect.pipe(
		Effect.mapError((error) =>
			error._tag === "PgBossPayloadError" ? new JobsPayloadInvalid({ queue: error.queue }) : new JobsUnavailable({ operation: error.operation }),
		),
	);
}

export function jobsHandlers<const TQueues extends readonly JobsQueue[], TService>(
	page: ReturnType<typeof jobsPage<TQueues>>,
	service: Context.Service<TService, PgBossService>,
) {
	function registered(name: string) {
		const queues: readonly TQueues[number][] = page.queues;
		const queue = queues.find((candidate) => candidate.name === name);
		return queue === undefined ? Effect.fail(new JobsQueueUnregistered({ queue: name })) : Effect.succeed(queue);
	}
	return page.contract.application.toLayer({
		"admin.jobs.counts": ({ queue }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return yield* failures(jobs.counts(definition));
			}),
		"admin.jobs.deadLettered": ({ queue, ...options }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return yield* failures(jobs.deadLetteredJobs<string, TQueues[number]["schema"]>(definition, options));
			}),
		"admin.jobs.failed": ({ queue, ...options }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return yield* failures(jobs.failedJobs<string, TQueues[number]["schema"]>(definition, options));
			}),
		"admin.jobs.health": () =>
			Effect.gen(function* () {
				const jobs = yield* service;
				const health = yield* failures(jobs.health);
				const visible = health.jobs.filter((queue) => page.queues.some((candidate) => candidate.name === queue.name));
				return {
					activeTotal: visible.reduce((sum, queue) => sum + queue.activeCount, 0),
					deadLetteredTotal: visible.reduce((sum, queue) => sum + queue.deadLetteredCount, 0),
					failedTotal: visible.reduce((sum, queue) => sum + queue.failedCount, 0),
					jobs: visible,
					queuedTotal: visible.reduce((sum, queue) => sum + queue.queuedCount, 0),
					readyTotal: visible.reduce((sum, queue) => sum + queue.readyCount, 0),
				};
			}),
		"admin.jobs.job": ({ id, queue }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return Option.map(yield* failures(jobs.getJob<string, TQueues[number]["schema"]>(definition, id)), (job) => ({
					attempt: job.startedOn === null ? 0 : job.retryCount + 1,
					completedOn: Option.map(Option.fromNullishOr(job.completedOn), DateTime.makeUnsafe),
					createdOn: DateTime.makeUnsafe(job.createdOn),
					data: job.data,
					id: job.id,
					output: job.output,
					queue: job.name,
					retryCount: job.retryCount,
					retryLimit: job.retryLimit,
					startedOn: Option.map(Option.fromNullishOr(job.startedOn), DateTime.makeUnsafe),
					state: job.state,
				}));
			}),
	});
}
