import type { QueueResult } from "pg-boss";

export function queueResult(name: string, counts: Partial<QueueResult>): QueueResult {
	return {
		activeCount: 0,
		blockedCount: 0,
		completedDelta: 0,
		createdDelta: 0,
		createdOn: new Date(0),
		deferredCount: 0,
		deltaOn: null,
		deltaSeconds: null,
		failedCount: 0,
		failedDelta: 0,
		name,
		queuedCount: 0,
		readyCount: 0,
		readyOldestSeconds: null,
		runBins: null,
		singletonsActive: null,
		table: name,
		totalCount: 0,
		updatedOn: new Date(0),
		waitBins: null,
		...counts,
	};
}
