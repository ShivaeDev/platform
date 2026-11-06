import { type Context, Effect, Option } from "effect";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import type { PgBossService } from "@shivaedev/jobs/server/service.ts";
import { type JobsEntry, type JobsPayload, jobsQueue } from "#jobs/entry.ts";
import { JobsNotFailed, type jobsPageWithRetry } from "#jobs/retryPage.ts";
import { JobsQueueUnregistered } from "#jobs/schemas.ts";
import { RetryJobs } from "#permissions.ts";
import { jobsFailures, jobsReadHandlers } from "./jobsHandlers.ts";

export function jobsHandlersWithRetry<const TQueues extends readonly JobsEntry[], TService>(
	page: ReturnType<typeof jobsPageWithRetry<TQueues>>,
	service: Context.Service<TService, PgBossService>,
) {
	return page.contract.application.toLayer({
		...jobsReadHandlers(page, service),
		"admin.jobs.retry": ({ queue, id }) =>
			Effect.gen(function* () {
				yield* requirePermission(yield* SessionUser, RetryJobs);
				const entries: readonly TQueues[number][] = page.queues;
				const entry = entries.find((candidate) => candidate.name === queue);
				if (entry === undefined) {
					return yield* Effect.fail(new JobsQueueUnregistered({ queue }));
				}
				const definition = jobsQueue(entry);
				const runtime = yield* service;
				const jobs = yield* runtime.inspection();
				const job = yield* jobsFailures(jobs.getJob<string, JobsPayload<TQueues[number]>>(definition, id));
				if (Option.isNone(job) || job.value.state !== "failed") {
					return yield* Effect.fail(new JobsNotFailed({ id, queue }));
				}
				yield* jobsFailures(runtime.retry(definition, id));
			}),
		"admin.jobs.runScheduleNow": ({ queue }) =>
			Effect.gen(function* () {
				yield* requirePermission(yield* SessionUser, RetryJobs);
				const entries: readonly JobsEntry[] = page.queues;
				const entry = entries.find((candidate) => candidate.name === queue && !("schema" in candidate));
				if (entry === undefined || "schema" in entry) {
					return yield* Effect.fail(new JobsQueueUnregistered({ queue }));
				}
				const runtime = yield* service;
				return yield* runtime.runScheduleNow({ name: entry.name, scheduleOptions: entry.scheduleOptions ?? {} }).pipe(
					Effect.catchTag("PgBossNotFoundError", () => Effect.fail(new JobsQueueUnregistered({ queue }))),
					Effect.catchTag("PgBossError", (error) => jobsFailures(Effect.fail(error))),
				);
			}),
	});
}
