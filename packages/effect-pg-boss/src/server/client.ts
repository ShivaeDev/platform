import type {
	ConstructorOptions,
	FindJobsOptions,
	Job,
	JobWithMetadata,
	Queue,
	QueueResult,
	ScheduleOptions,
	SendOptions,
	StopOptions,
	WorkOptions,
} from "pg-boss";
import { PgBoss } from "pg-boss";

export interface PgBossClient {
	readonly complete?: PgBoss["complete"];
	readonly createQueue: (name: string, options?: Omit<Queue, "name">) => Promise<void>;
	readonly fail?: PgBoss["fail"];
	readonly findJobs?: (name: string, options?: FindJobsOptions) => Promise<readonly JobWithMetadata<unknown>[]>;
	readonly getDb?: PgBoss["getDb"];
	readonly getQueue: (name: string) => Promise<QueueResult | null>;
	readonly off: (event: "error", listener: (error: Error) => void) => unknown;
	readonly offWork: (name: string) => Promise<void>;
	readonly on: (event: "error", listener: (error: Error) => void) => unknown;
	readonly retry?: PgBoss["retry"];
	readonly schedule: (name: string, cron: string, data?: object | null, options?: ScheduleOptions) => Promise<void>;
	readonly send: (name: string, data?: object | null, options?: SendOptions) => Promise<string | null>;
	readonly start: () => Promise<unknown>;
	readonly stop: (options?: StopOptions) => Promise<void>;
	readonly update?: PgBoss["update"];
	readonly updateQueue?: PgBoss["updateQueue"];
	readonly work: (name: string, options: WorkOptions, handler: (jobs: readonly Job<unknown>[]) => Promise<unknown>) => Promise<string>;
}

export type PgBossClientFactory = (options: ConstructorOptions) => PgBossClient;

export const defaultClientFactory: PgBossClientFactory = (options) => new PgBoss(options);
