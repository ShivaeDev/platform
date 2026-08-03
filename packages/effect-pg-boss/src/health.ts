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

export const deadLetterQueueName = (queueName: string): string =>
	`${queueName}-dlq`;
