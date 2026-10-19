import type { DateTime, Option } from "effect";
import type { JobWithMetadata } from "pg-boss";

export interface QueueCounts {
	readonly activeCount: number;
	readonly failedCount: number;
	readonly queuedCount: number;
	readonly totalCount: number;
}

export interface QueueHealth {
	readonly activeCount: number;
	readonly deadLetteredCount: number;
	readonly failedCount: number;
	readonly name: string;
	readonly queuedCount: number;
	readonly readyCount: number;
}

export interface JobsHealth {
	readonly activeTotal: number;
	readonly deadLetteredTotal: number;
	readonly failedTotal: number;
	readonly jobs: readonly QueueHealth[];
	readonly queuedTotal: number;
	readonly readyTotal: number;
}

export const deadLetterQueueName = (queueName: string): string => `${queueName}-dlq`;

export interface ListedJob<TData> {
	readonly attempt: number;
	readonly completedOn: Option.Option<DateTime.Utc>;
	readonly createdOn: DateTime.Utc;
	readonly data: TData;
	readonly id: string;
	readonly output: unknown;
	readonly queue: string;
	readonly retryCount: number;
	readonly retryLimit: number;
	readonly startedOn: Option.Option<DateTime.Utc>;
	readonly state: JobWithMetadata["state"];
}

export interface DeadLetteredJob<TData> extends ListedJob<TData> {
	readonly sourceId: Option.Option<string>;
	readonly sourceOutput: unknown;
}

export interface JobPageOptions {
	readonly cursor?: string | undefined;
	readonly limit: number;
}

export interface JobPage<TJob> {
	readonly jobs: readonly TJob[];
	readonly next: Option.Option<string>;
}
