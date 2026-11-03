export type JobState = "created" | "retry" | "active" | "completed" | "cancelled" | "failed";

export interface WorkerJob<T = unknown> {
	data: T;
	expireInSeconds: number;
	groupId?: string | null;
	groupTier?: string | null;
	heartbeatSeconds: number | null;
	id: string;
	name: string;
	retryCount: number;
	signal: AbortSignal;
}
export interface Job<T = unknown> extends WorkerJob<T> {
	blocked: boolean;
	blocking: boolean;
	completedOn: Date | null;
	createdOn: Date;
	deadLetter: string;
	deleteAfterSeconds: number;
	heartbeatOn: Date | null;
	keepUntil: Date;
	output: object | null;
	pendingDependencies: number;
	policy: string;
	priority: number;
	retryBackoff: boolean;
	retryDelay: number;
	retryDelayMax?: number;
	retryLimit: number;
	singletonKey: string | null;
	singletonOn: Date | null;
	sourceCreatedOn: Date | null;
	sourceId: string | null;
	sourceName: string | null;
	sourceOutput: object | null;
	sourceRetryCount: number | null;
	sourceRootId: string | null;
	startAfter: Date;
	startedOn: Date | null;
	state: JobState;
}
