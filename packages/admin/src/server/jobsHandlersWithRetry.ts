import { type Context, Effect, Option } from "effect";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { JobsNotFailed, type jobsPageWithRetry } from "#jobs/retryPage.ts";
import { type JobsQueue, JobsQueueUnregistered } from "#jobs/schemas.ts";
import { jobsFailures, jobsReadHandlers } from "./jobsHandlers.ts";

export function jobsHandlersWithRetry<const TQueues extends readonly JobsQueue[], TService>(
	page: ReturnType<typeof jobsPageWithRetry<TQueues>>,
	service: Context.Service<TService, PgBossService>,
) {
	return page.contract.application.toLayer({
		...jobsReadHandlers(page, service),
		"admin.jobs.retry": ({ queue, id }) =>
			Effect.gen(function* () {
				const definition = page.queues.find((candidate) => candidate.name === queue);
				if (definition === undefined) {
					return yield* Effect.fail(new JobsQueueUnregistered({ queue }));
				}
				const jobs = yield* service;
				const job = yield* jobsFailures(jobs.getJob<string, TQueues[number]["schema"]>(definition, id));
				if (Option.isNone(job) || job.value.state !== "failed") {
					return yield* Effect.fail(new JobsNotFailed({ id, queue }));
				}
				yield* jobsFailures(jobs.retry(definition, id));
			}),
	});
}
