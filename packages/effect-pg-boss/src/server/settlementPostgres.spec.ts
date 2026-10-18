import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { boss, realPostgres } from "#test/boss.ts";
import { eventually } from "#test/eventually.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

for (const outcome of ["failure", "defect", "primitive failure"] as const) {
	boss.it.runIf(postgresConfigured)(`isolates one ${outcome} in a batch of ten`, [realPostgres], function* ({ boot, admin }) {
		const Queue = defineQueue({
			name: "settlement",
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
			schema: Schema.Struct({ id: Schema.Number }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const client = yield* admin();
		const attempts = new Map<number, number>();
		const failure = new Error(`poison job ${outcome}`);
		const failed = outcome === "defect" ? Effect.die(failure) : Effect.fail(outcome === "primitive failure" ? failure.message : failure);
		yield* Effect.promise(async () => {
			await client.createQueue(Queue.name, Queue.queueOptions);
			await client.insert(
				Queue.name,
				Array.from({ length: 10 }, (_, id) => ({ data: { id } })),
			);
		});
		yield* boot([
			Queue.handle(({ id }) =>
				Effect.suspend(() => {
					attempts.set(id, (attempts.get(id) ?? 0) + 1);
					return id === 4 ? failed : Effect.void;
				}),
			),
		]);
		const stored = yield* eventually(
			Effect.promise(() => client.findJobs<{ id: number }>(Queue.name)),
			(jobs) => jobs.length === 10 && jobs.every((job) => job.state === "completed" || job.state === "failed"),
		);
		expect(stored.filter((job) => job.state === "completed")).toHaveLength(9);
		expect(stored.filter((job) => job.state === "failed")).toMatchObject([{ data: { id: 4 }, output: { message: failure.message }, retryCount: 1 }]);
		for (const job of stored) {
			expect(attempts.get(job.data.id)).toBe(job.data.id === 4 ? 2 : 1);
			expect(job.retryCount).toBe(job.data.id === 4 ? 1 : 0);
		}
	});
}
