import { Effect, Schema } from "effect";
import type { batchBudget } from "#test/batchBudget.ts";
import { observeWorker } from "#test/observeWorker.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";
import { waitingVerbs } from "#test/waitingVerbs.ts";

export function budgetVerbs(budget: ReturnType<typeof batchBudget>, runtime: ReturnType<typeof pgBossRuntime>) {
	const { until, untilJobs } = waitingVerbs();
	let seeded: string[] = [];
	const options = { monitorIntervalSeconds: 1, superviseIntervalSeconds: 1 };
	const client = runtime.native(options);
	const peer = observeWorker(runtime.native(options), (jobs) => {
		budget.peerRetries.push(...jobs.filter((job) => job.retryCount > 0).map((job) => Schema.decodeUnknownSync(budget.queue.schema)(job.data).id));
		return budget.record(jobs);
	});
	return {
		...budget,
		completed: () =>
			untilJobs<{ id: number }>(
				client,
				budget.queue.name,
				(jobs) =>
					seeded.length > 0
					&& seeded.every((id) =>
						jobs.some((job) => job.id === id && (job.state === "completed" || job.state === "failed" || job.state === "cancelled")),
					),
			),
		firstClaim: until(
			Effect.sync(() => budget.batches.length),
			(count) => count > 0,
		),
		seed: () =>
			runtime
				.seed(
					budget.queue,
					Array.from({ length: 4 }, (_, id) => ({ data: { id }, expireInSeconds: id === 0 || id === 3 ? 4 : 1 })),
					client,
				)
				.pipe(
					Effect.tap((ids) =>
						Effect.sync(() => {
							seeded = ids;
						}),
					),
				),
		start: () => runtime.boot([budget.worker], { clientFactory: () => observeWorker(client, budget.record) }),
		startPeer: () => runtime.boot([budget.worker], { clientFactory: () => peer }),
	};
}
