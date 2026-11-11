import { Context, type Effect, type Option } from "effect";
import type { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import type { DeadLetteredJob, JobPage, JobPageOptions, JobsHealth, ListedJob, QueueCounts } from "@shivaedev/jobs/server/health.ts";
import type { Job } from "@shivaedev/jobs/server/job.ts";
import type { JobsNotFailed } from "#jobs/NotFailed.ts";
import type { JobsPayloadInvalid, JobsQueueUnregistered, JobsUnavailable } from "#jobs/schemas.ts";

type Read = JobsUnavailable | JobsQueueUnregistered;
type Listing = Read | JobsPayloadInvalid | BadRequest;

export class RegisteredQueues extends Context.Service<
	RegisteredQueues,
	{
		readonly counts: (queue: string) => Effect.Effect<QueueCounts, Read>;
		readonly deadLetteredJobs: (queue: string, options: JobPageOptions) => Effect.Effect<JobPage<DeadLetteredJob<unknown>>, Listing>;
		readonly failedJobs: (queue: string, options: JobPageOptions) => Effect.Effect<JobPage<ListedJob<unknown>>, Listing>;
		readonly getJob: (queue: string, id: string) => Effect.Effect<Option.Option<Job<unknown>>, Read | JobsPayloadInvalid>;
		readonly health: () => Effect.Effect<JobsHealth, JobsUnavailable>;
		readonly retry: (queue: string, id: string) => Effect.Effect<void, Read | JobsPayloadInvalid | JobsNotFailed>;
		readonly runScheduleNow: (schedule: string) => Effect.Effect<Option.Option<string>, Read>;
	}
>()("@shivaedev/admin/RegisteredQueues") {}
