import { Context, type Effect } from "effect";
import type { KeysetPageQuery } from "@shivaedev/sql/keysetPage.ts";
import type { PgBossClient } from "#server/adapters/client.ts";
import type { PgBossError } from "#server/error.ts";
import type { PgBossService } from "#server/service.ts";

export type StoredJob = Awaited<ReturnType<NonNullable<PgBossClient["findJobs"]>>>[number];
export type JobAttempt = Pick<StoredJob, "name" | "id" | "retryCount">;
export type Listing = "deadLetteredJobs" | "failedJobs";

export class JobEngine extends Context.Service<
	JobEngine,
	Pick<PgBossService, "deleteQueue" | "refreshQueueStats" | "runScheduleNow" | "unschedule"> & {
		readonly getJob: (queue: string, id: string) => Effect.Effect<StoredJob | undefined, PgBossError>;
		readonly retry: (queue: string, id: string) => Effect.Effect<void, PgBossError>;
		readonly listJobs: (listing: Listing, queue: string, query: KeysetPageQuery) => Effect.Effect<readonly unknown[], PgBossError>;
		readonly settleDeferral: (
			job: JobAttempt,
			at: string,
			reason: string,
			maxDeferrals: number,
		) => Effect.Effect<{ readonly claimed: boolean; readonly deferred: boolean }, PgBossError>;
	}
>()("@shivaedev/jobs/JobEngine") {}
