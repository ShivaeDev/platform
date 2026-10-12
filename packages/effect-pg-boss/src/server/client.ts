import type { ConstructorOptions, Job, Queue, QueueResult, ScheduleOptions, SendOptions, StopOptions, WorkOptions } from "pg-boss";
import { PgBoss } from "pg-boss";

export interface PgBossClient {
	readonly createQueue: (name: string, options?: Omit<Queue, "name">) => Promise<void>;
	readonly getQueue: (name: string) => Promise<QueueResult | null>;
	readonly off: (event: "error", listener: (error: Error) => void) => unknown;
	readonly offWork: (name: string) => Promise<void>;
	readonly on: (event: "error", listener: (error: Error) => void) => unknown;
	readonly schedule: (name: string, cron: string, data?: object | null, options?: ScheduleOptions) => Promise<void>;
	readonly send: (name: string, data?: object | null, options?: SendOptions) => Promise<string | null>;
	readonly start: () => Promise<unknown>;
	readonly stop: (options?: StopOptions) => Promise<void>;
	readonly work: (name: string, options: WorkOptions, handler: (jobs: readonly Job<unknown>[]) => Promise<unknown>) => Promise<string>;
}

export type PgBossClientFactory = (options: ConstructorOptions) => PgBossClient;

export const defaultClientFactory: PgBossClientFactory = (options) => new PgBoss(options);
