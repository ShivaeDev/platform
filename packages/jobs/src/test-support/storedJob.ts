import type { JobWithMetadata } from "pg-boss";
import { job } from "#test/fakeClient.ts";

export function storedJob(name: string, data: unknown): JobWithMetadata<unknown> {
	return {
		...job(name, data),
		blocked: false,
		blocking: false,
		completedOn: null,
		createdOn: new Date(0),
		deadLetter: `${name}-dlq`,
		deleteAfterSeconds: 3600,
		heartbeatOn: null,
		keepUntil: new Date(0),
		output: {},
		pendingDependencies: 0,
		policy: "standard",
		priority: 0,
		retryBackoff: false,
		retryDelay: 0,
		retryLimit: 0,
		singletonKey: null,
		singletonOn: null,
		sourceCreatedOn: null,
		sourceId: null,
		sourceName: null,
		sourceOutput: null,
		sourceRetryCount: null,
		sourceRootId: null,
		startAfter: new Date(0),
		startedOn: new Date(0),
		state: "failed",
	};
}
