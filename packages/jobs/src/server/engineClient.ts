import type { ClientDatabase } from "#server/ClientDatabase.ts";
import type { JobReadOptions, PgBossClient } from "#server/client.ts";
import type { ScheduleOptions } from "#server/enqueueOptions.ts";
import type { Job } from "#server/job.ts";

export interface EngineSchedule {
	cron: string;
	data?: object;
	key: string;
	name: string;
	options?: ScheduleOptions;
	timezone: string;
}

export interface EngineClient extends Required<PgBossClient> {
	readonly emit: (event: "error", error: Error) => boolean;
	readonly findJobs: <T = unknown>(name: string, options?: JobReadOptions) => Promise<Job<T>[]>;
	readonly getDb: () => ClientDatabase;
	readonly getSchedules: (name?: string, key?: string) => Promise<EngineSchedule[]>;
	readonly schemaVersion: () => Promise<number | null>;
	readonly supervise: (name?: string) => Promise<void>;
}
