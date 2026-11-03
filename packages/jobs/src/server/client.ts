import type { ClientDatabase } from "#server/ClientDatabase.ts";
import type { ClientOptions, StopOptions } from "#server/clientOptions.ts";
import type { EnqueueOptions, ScheduleOptions } from "#server/enqueueOptions.ts";
import type { Job, WorkerJob } from "#server/job.ts";
import type { QueueOptions } from "#server/queueOptions.ts";
import type { WorkerOptions } from "#server/workerOptions.ts";

export interface JobReadOptions {
	readonly after?: string;
	readonly data?: object;
	readonly db?: ClientDatabase;
	readonly id?: string;
	readonly key?: string;
	readonly limit?: number;
	readonly queued?: boolean;
}

export interface ClientQueueOptions extends Omit<QueueOptions, "maxDeferrals" | "policy"> {
	readonly deadLetter?: string;
	readonly policy?: string;
}

export interface ClientQueue extends ClientQueueOptions {
	readonly activeCount: number;
	readonly blockedCount: number;
	readonly deferredCount: number;
	readonly failedCount: number;
	readonly name: string;
	readonly queuedCount: number;
	readonly readyCount: number;
	readonly totalCount: number;
}

export type JobTarget = string | string[] | { id: string; retryCount: number } | { id: string; retryCount: number }[];
export interface ClientConnectionOptions {
	readonly db?: ClientDatabase;
}
export interface ClientUpdateOptions extends Omit<EnqueueOptions, "singletonSeconds" | "singletonNextSlot"> {
	readonly match?: "newest" | "oldest" | "all";
}
export interface ClientUpdateRequest {
	data?: object | null;
	name: string;
	options?: ClientUpdateOptions;
}
export interface ClientUpdateResult {
	jobs: string[];
	updated: number;
}

export interface PgBossClient {
	readonly complete?: (
		name: string,
		id: JobTarget,
		data?: object | null,
		options?: ClientConnectionOptions & { includeQueued?: boolean },
	) => Promise<object>;
	readonly createQueue: (name: string, options?: ClientQueueOptions) => Promise<void>;
	readonly deleteQueue?: (name: string) => Promise<void>;
	readonly fail?: (name: string, id: JobTarget, data?: object | null, options?: ClientConnectionOptions) => Promise<object>;
	readonly findJobs?: (name: string, options?: JobReadOptions) => Promise<readonly Job<unknown>[]>;
	readonly getDb?: () => ClientDatabase;
	readonly getQueue: (name: string) => Promise<ClientQueue | null>;
	readonly getWipData?: (options?: { includeInternal?: boolean }) => { id: string; workId: string; name: string; count: number }[];
	readonly notifyWorker?: (workerId: string) => void;
	readonly off: (event: "error", listener: (error: Error) => void) => unknown;
	readonly offWork: (name: string, options?: { id?: string; wait?: boolean }) => Promise<void>;
	readonly on: (event: "error", listener: (error: Error) => void) => unknown;
	readonly retry?: (name: string, id: string | string[], options?: ClientConnectionOptions) => Promise<object>;
	readonly schedule: (name: string, cron: string, data?: object | null, options?: ScheduleOptions) => Promise<void>;
	readonly send: (name: string, data?: object | null, options?: EnqueueOptions) => Promise<string | null>;
	readonly start: () => Promise<unknown>;
	readonly stop: (options?: StopOptions) => Promise<void>;
	readonly unschedule?: (name: string, key?: string, options?: ClientConnectionOptions) => Promise<void>;
	readonly update?: {
		(request: ClientUpdateRequest): Promise<ClientUpdateResult>;
		(name: string, data: object | null | undefined, options?: ClientUpdateOptions): Promise<ClientUpdateResult>;
	};
	readonly updateQueue?: (
		name: string,
		options: Omit<QueueOptions, "policy" | "partition" | "maxDeferrals" | "heartbeatSeconds" | "retryDelayMax"> & {
			deadLetter?: string | null;
			heartbeatSeconds?: number | null;
			retryDelayMax?: number | null;
		},
	) => Promise<void>;
	readonly work: (name: string, options: WorkerOptions, handler: (jobs: readonly WorkerJob<unknown>[]) => Promise<unknown>) => Promise<string>;
}

export type PgBossClientFactory = (options: ClientOptions) => PgBossClient;
