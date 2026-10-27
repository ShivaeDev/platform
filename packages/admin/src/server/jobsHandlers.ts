import { type Context, DateTime, Effect, Option } from "effect";
import type { PgBossError, PgBossPayloadError } from "@shivaedev/jobs/server/error.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { type JobsEntry, type JobsPayload, jobsQueue } from "#jobs/entry.ts";
import type { jobsPage } from "#jobs/page.ts";
import { JobsPayloadInvalid, JobsQueueUnregistered, JobsUnavailable } from "#jobs/schemas.ts";

export function jobsFailures<A, R>(effect: Effect.Effect<A, PgBossError | PgBossPayloadError, R>) {
	return effect.pipe(
		Effect.mapError((error) =>
			error._tag === "PgBossPayloadError" ? new JobsPayloadInvalid({ queue: error.queue }) : new JobsUnavailable({ operation: error.operation }),
		),
	);
}

export function jobsReadHandlers<const TQueues extends readonly JobsEntry[], TService>(
	page: { readonly queues: TQueues },
	service: Context.Service<TService, PgBossService>,
) {
	function registered(name: string) {
		const queues: readonly TQueues[number][] = page.queues;
		const queue = queues.find((candidate) => candidate.name === name);
		return queue === undefined ? Effect.fail(new JobsQueueUnregistered({ queue: name })) : Effect.succeed(jobsQueue(queue));
	}
	return {
		"admin.jobs.counts": ({ queue }: { readonly queue: string }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return yield* jobsFailures(jobs.counts(definition));
			}),
		"admin.jobs.deadLettered": ({ queue, ...options }: { readonly queue: string; readonly limit: number; readonly cursor?: string }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return yield* jobsFailures(jobs.deadLetteredJobs<string, JobsPayload<TQueues[number]>>(definition, options));
			}),
		"admin.jobs.failed": ({ queue, ...options }: { readonly queue: string; readonly limit: number; readonly cursor?: string }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return yield* jobsFailures(jobs.failedJobs<string, JobsPayload<TQueues[number]>>(definition, options));
			}),
		"admin.jobs.health": () =>
			Effect.gen(function* () {
				const jobs = yield* service;
				const health = yield* jobsFailures(jobs.health);
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
		"admin.jobs.job": ({ id, queue }: { readonly id: string; readonly queue: string }) =>
			Effect.gen(function* () {
				const definition = yield* registered(queue);
				const jobs = yield* service;
				return Option.map(yield* jobsFailures(jobs.getJob<string, JobsPayload<TQueues[number]>>(definition, id)), (job) => ({
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
	};
}

export function jobsHandlers<const TQueues extends readonly JobsEntry[], TService>(
	page: ReturnType<typeof jobsPage<TQueues>>,
	service: Context.Service<TService, PgBossService>,
) {
	return page.contract.application.toLayer(jobsReadHandlers(page, service));
}
