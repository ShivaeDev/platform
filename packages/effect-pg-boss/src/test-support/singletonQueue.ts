import { Schema } from "effect";
import type { QueueOptions } from "#definition.ts";
import { defineQueue } from "#definition.ts";

export const PullRequestJob = Schema.Union([
	Schema.TaggedStruct("Refresh", { pullRequestId: Schema.NumberFromString }),
	Schema.TaggedStruct("Reconcile", { pullRequestId: Schema.NumberFromString }),
]);

export function singletonQueue(queue?: Omit<QueueOptions, "policy">) {
	return defineQueue({
		key: ({ pullRequestId }) => `pr:${pullRequestId.toFixed(0)}`,
		name: "pull-request",
		queue: { ...queue, policy: "singleton" },
		schema: PullRequestJob,
		worker: { batchSize: 1, localConcurrency: 3, pollingIntervalSeconds: 0.5 },
	});
}
