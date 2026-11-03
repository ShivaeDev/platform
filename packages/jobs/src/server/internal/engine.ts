import { Context, type Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import type { PgBossError, PgBossTestingError } from "#server/error.ts";
import type { PgBossService } from "#server/service.ts";

export type StoredJob = Awaited<ReturnType<NonNullable<PgBossClient["findJobs"]>>>[number];
export type JobAttempt = Pick<StoredJob, "name" | "id" | "retryCount">;
export type Listing = "deadLetteredJobs" | "failedJobs";

export class JobEngine extends Context.Service<
	JobEngine,
	Pick<PgBossService, "deleteQueue" | "refreshQueueStats" | "unschedule"> & {
		readonly getJob: (queue: string, id: string) => Effect.Effect<StoredJob | undefined, PgBossError>;
		readonly retry: (queue: string, id: string) => Effect.Effect<void, PgBossError>;
		readonly listJobs: (
			listing: Listing,
			queue: string,
			after: readonly [string, string] | undefined,
			limit: number,
		) => Effect.Effect<readonly unknown[], PgBossError>;
		readonly settleDeferral: (
			job: JobAttempt,
			at: string,
			reason: string,
			maxDeferrals: number,
		) => Effect.Effect<{ readonly claimed: boolean; readonly deferred: boolean }, PgBossError>;
	}
>()("@shivaedev/jobs/JobEngine") {}

export interface TestingSettlements {
	readonly close: Effect.Effect<void>;
	readonly watch: (name: string) => Effect.Effect<void, PgBossTestingError>;
}

export class TestingEngine extends Context.Service<
	TestingEngine,
	{
		readonly expireAttempt: (job: JobAttempt, cause?: "expiry" | "heartbeat") => Effect.Effect<void, PgBossTestingError>;
		readonly observeSettlements: (settled: (name: string) => void) => Effect.Effect<TestingSettlements>;
	}
>()("@shivaedev/jobs/TestingEngine") {}
