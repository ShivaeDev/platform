import { Schema } from "effect";
import type { Queue } from "pg-boss";
import { defineQueue } from "#definition.ts";
import { type Attempt, workerBy } from "#test/workers.ts";

const Refresh = Schema.TaggedStruct("Refresh", { pullRequestId: Schema.NumberFromString });
const Reconcile = Schema.TaggedStruct("Reconcile", { pullRequestId: Schema.NumberFromString });

export const PullRequestJob = Schema.Union([Refresh, Reconcile]);

type PullRequestJob = typeof PullRequestJob.Type;

export function singletonQueueOptions(queue?: Omit<Queue, "name" | "deadLetter" | "policy">) {
	return {
		key: ({ pullRequestId }: PullRequestJob) => `pr:${pullRequestId.toFixed(0)}`,
		name: "pull-request",
		queue: { ...queue, policy: "singleton" },
		schema: PullRequestJob,
		worker: { batchSize: 1, localConcurrency: 3, pollingIntervalSeconds: 0.5 },
	} as const;
}

export function pullRequestQueue(queue?: Omit<Queue, "name" | "deadLetter" | "policy">) {
	return defineQueue(singletonQueueOptions(queue));
}

export function refresh(pullRequestId: number): PullRequestJob {
	return Refresh.make({ pullRequestId });
}

export function reconcile(pullRequestId: number): PullRequestJob {
	return Reconcile.make({ pullRequestId });
}

export function pullRequestWorker(queue: ReturnType<typeof pullRequestQueue>, attempts: { readonly refresh: Attempt; readonly reconcile: Attempt }) {
	return workerBy(queue, (job) => (Schema.is(Refresh)(job) ? attempts.refresh : attempts.reconcile));
}
