import { Schema } from "effect";
import type { Queue } from "pg-boss";

export const PullRequestJob = Schema.Union([
	Schema.TaggedStruct("Refresh", { pullRequestId: Schema.NumberFromString }),
	Schema.TaggedStruct("Reconcile", { pullRequestId: Schema.NumberFromString }),
]);

export function singletonQueueOptions(queue?: Omit<Queue, "name" | "deadLetter" | "policy">) {
	return {
		key: ({ pullRequestId }: typeof PullRequestJob.Type) => `pr:${pullRequestId.toFixed(0)}`,
		name: "pull-request",
		queue: { ...queue, policy: "singleton" },
		schema: PullRequestJob,
		worker: { batchSize: 1, localConcurrency: 3, pollingIntervalSeconds: 0.5 },
	} as const;
}
