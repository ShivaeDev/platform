export interface GroupConcurrencyConfig {
	default: number;
	tiers?: Record<string, number>;
}

export interface WorkerOptions {
	batchSize?: number;
	burstWhenBatchFull?: boolean;
	burstWhenReadyExceeds?: number;
	groupConcurrency?: number | GroupConcurrencyConfig;

	heartbeatRefreshSeconds?: number;
	ignoreStartAfter?: boolean;
	includeMetadata?: boolean;

	localConcurrency?: number;
	localGroupConcurrency?: number | GroupConcurrencyConfig;
	maxPriority?: number;
	minPriority?: number;
	notifyPollingIntervalSeconds?: number;
	orderByCreatedOn?: boolean;
	perJobResults?: boolean;

	pollingIntervalSeconds?: number;
	priority?: boolean;
	transactional?: boolean;
	transactionTimeoutSeconds?: number;
}
