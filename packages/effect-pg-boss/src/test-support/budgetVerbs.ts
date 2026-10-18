import { Effect, Schema } from "effect";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import type { batchBudget } from "#test/batchBudget.ts";
import { observeWorker } from "#test/observeWorker.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";

export function budgetVerbs(budget: ReturnType<typeof batchBudget>, runtime: ReturnType<typeof pgBossRuntime>) {
	const seeded = new Set<string>();
	const options = { monitorIntervalSeconds: 1, superviseIntervalSeconds: 1 };
	const client = runtime.native(options);
	const peer = observeWorker(runtime.native(options), (jobs) => {
		budget.peerRetries.push(...jobs.filter((job) => job.retryCount > 0).map((job) => Schema.decodeUnknownSync(budget.queue.schema)(job.data).id));
		return budget.record(jobs);
	});
	const terminalJobs = Effect.promise(() => client.findJobs<{ id: number }>(budget.queue.name)).pipe(
		Effect.filterOrFail(
			(jobs) =>
				seeded.size > 0
				&& [...seeded].every((id) =>
					jobs.some((job) => job.id === id && (job.state === "completed" || job.state === "failed" || job.state === "cancelled")),
				),
		),
	);
	return {
		...budget,
		completed: () => eventually(terminalJobs, { interval: 50 }).pipe(Effect.timeout(15_000)),
		firstClaim: eventually(Effect.sync(() => budget.batches.length).pipe(Effect.filterOrFail((count) => count > 0)), { interval: 50 }).pipe(
			Effect.timeout(15_000),
		),
		seed: () =>
			Effect.gen(function* () {
				yield* Effect.acquireRelease(
					Effect.promise(() => client.start()),
					() => Effect.promise(() => client.stop()),
				);
				yield* Effect.promise(async () => {
					await client.createQueue(budget.queue.name, budget.queue.queueOptions);
					const ids = await client.insert(
						budget.queue.name,
						Array.from({ length: 4 }, (_, id) => ({ data: { id }, expireInSeconds: id === 0 || id === 3 ? 4 : 1 })),
						{ returnId: true },
					);
					if (ids === null || ids.length === 0) {
						throw new Error("No batch jobs were seeded");
					}
					for (const id of ids) {
						seeded.add(id);
					}
				});
			}),
		start: () => runtime.boot([budget.worker], { clientFactory: () => observeWorker(client, budget.record) }),
		startPeer: () => runtime.boot([budget.worker], { clientFactory: () => peer }),
	};
}
