import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

for (const outcome of ["failure", "defect", "primitive failure"] as const) {
	postgresIt(`isolates one ${outcome} in a batch of ten`, [realPostgres], function* ({ boot, native, seed, untilJobs }) {
		const Queue = defineQueue({
			name: "settlement",
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
			schema: Schema.Struct({ id: Schema.Number }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const client = native();
		const attempts = new Map<number, number>();
		const failure = new Error(`poison job ${outcome}`);
		const failed = outcome === "defect" ? Effect.die(failure) : Effect.fail(outcome === "primitive failure" ? failure.message : failure);
		yield* seed(
			Queue,
			Array.from({ length: 10 }, (_, id) => ({ data: { id } })),
			client,
		);
		yield* boot([
			Queue.handle(({ id }) =>
				Effect.suspend(() => {
					attempts.set(id, (attempts.get(id) ?? 0) + 1);
					return id === 4 ? failed : Effect.void;
				}),
			),
		]);
		const stored = yield* untilJobs<{ id: number }>(
			client,
			Queue.name,
			(jobs) => jobs.length === 10 && jobs.every((job) => job.state === "completed" || job.state === "failed"),
		);
		expect(
			stored
				.filter((job) => job.state === "completed")
				.map((job) => job.data.id)
				.sort((left, right) => left - right),
		).toEqual([0, 1, 2, 3, 5, 6, 7, 8, 9]);
		expect(stored.filter((job) => job.state === "failed")).toMatchObject([{ data: { id: 4 }, output: { message: failure.message }, retryCount: 1 }]);
		for (const job of stored) {
			expect(attempts.get(job.data.id)).toBe(job.data.id === 4 ? 2 : 1);
			expect(job.retryCount).toBe(job.data.id === 4 ? 1 : 0);
		}
	});
}
