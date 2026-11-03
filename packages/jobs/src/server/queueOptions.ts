export type QueuePolicy = "standard" | "short" | "singleton" | "stately" | "exclusive" | "key_strict_fifo";

export interface RetryOptions {
	deleteAfterSeconds?: number;
	expireInSeconds?: number;
	heartbeatSeconds?: number;
	retentionSeconds?: number;
	retryBackoff?: boolean;
	retryDelay?: number;
	retryDelayMax?: number;
	retryLimit?: number;
}

export interface QueueOptions extends RetryOptions {
	readonly maxDeferrals?: number;
	readonly notify?: boolean;
	readonly partition?: boolean;
	readonly policy?: QueuePolicy;
	readonly warningQueueSize?: number;
}
