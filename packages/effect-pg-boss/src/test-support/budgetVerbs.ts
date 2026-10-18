import { Effect, Schema } from "effect";
import type { batchBudget } from "#test/batchBudget.ts";
import { eventually } from "#test/eventually.ts";
import { observeWorker } from "#test/observeWorker.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";

export function budgetVerbs(budget: ReturnType<typeof batchBudget>, runtime: ReturnType<typeof pgBossRuntime>) {
	const options = { monitorIntervalSeconds: 1, superviseIntervalSeconds: 1 };
	const client = runtime.native(options);
	const peer = observeWorker(runtime.native(options), (jobs) => {
		budget.peerRetries.push(...jobs.filter((job) => job.retryCount > 0).map((job) => Schema.decodeUnknownSync(budget.queue.schema)(job.data).id));
		return budget.record(jobs);
	});
	return {
		...budget,
		completed: () =>
			eventually(
				Effect.promise(() => client.findJobs<{ id: number }>(budget.queue.name)),
				(jobs) => jobs.length === 4 && jobs.every((job) => job.state === "completed"),
			),
		firstClaim: eventually(
			Effect.sync(() => budget.batches.length),
			(count) => count > 0,
		),
		seed: () =>
			Effect.gen(function* () {
				yield* Effect.acquireRelease(
					Effect.promise(() => client.start()),
					() => Effect.promise(() => client.stop()),
				);
				yield* Effect.promise(async () => {
					await client.createQueue(budget.queue.name, budget.queue.queueOptions);
					await client.insert(
						budget.queue.name,
						Array.from({ length: 4 }, (_, id) => ({ data: { id }, expireInSeconds: id === 0 || id === 3 ? 4 : 1 })),
					);
				});
			}),
		start: () => runtime.boot([budget.worker], { clientFactory: () => observeWorker(client, budget.record) }),
		startPeer: () => runtime.boot([budget.worker], { clientFactory: () => peer }),
	};
}
