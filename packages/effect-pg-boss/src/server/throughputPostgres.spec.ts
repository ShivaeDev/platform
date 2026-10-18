import { Effect, Schema } from "effect";
import type { WorkOptions } from "pg-boss";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { boss, realPostgres } from "#test/boss.ts";
import { eventually } from "#test/eventually.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

const cases: readonly { name: string; worker: WorkOptions; duration: number; concurrency: number }[] = [
	{ concurrency: 1, duration: 20, name: "defaults", worker: {} },
	{ concurrency: 5, duration: 100, name: "configured batches and local concurrency", worker: { batchSize: 2, localConcurrency: 5 } },
];

for (const { worker, duration, concurrency, name } of cases) {
	boss.it.runIf(postgresConfigured)(
		`drains 30 notification jobs with ${name} without waiting for polling`,
		[realPostgres],
		function* ({ boot, native }) {
			const Queue = defineQueue({
				name: "backlog",
				queue: { notify: true },
				schema: Schema.Struct({ id: Schema.Number }),
				worker: { pollingIntervalSeconds: 10, ...worker },
			});
			const client = native({ useListenNotify: true });
			yield* Effect.acquireRelease(
				Effect.promise(() => client.start()),
				() => Effect.promise(() => client.stop()),
			);
			const handled: number[] = [];
			let active = 0;
			let peak = 0;
			const handler = Queue.handle(({ id }) =>
				Effect.gen(function* () {
					active += 1;
					peak = Math.max(peak, active);
					yield* Effect.sleep(duration);
					handled.push(id);
					active -= 1;
				}),
			);
			yield* Effect.promise(async () => {
				await client.createQueue(Queue.name, { notify: true });
				await client.insert(
					Queue.name,
					Array.from({ length: 30 }, (_, id) => ({ data: { id } })),
				);
			});
			const started = performance.now();
			yield* boot([handler], { clientFactory: () => client });
			yield* eventually(
				Effect.promise(() => client.findJobs(Queue.name)),
				(jobs) => jobs.filter((job) => job.state === "completed").length === 30,
				2500,
			);
			expect(performance.now() - started).toBeLessThan(2500);
			expect([...handled].sort((left, right) => left - right)).toEqual(Array.from({ length: 30 }, (_, id) => id));
			expect(peak).toBe(concurrency);
		},
	);
}
