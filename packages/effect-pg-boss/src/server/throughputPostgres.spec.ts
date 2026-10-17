import { Effect, Schema } from "effect";
import { PgBoss, type WorkOptions } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

const cases: readonly { name: string; worker: WorkOptions; duration: number; concurrency: number }[] = [
	{ concurrency: 1, duration: 20, name: "defaults", worker: {} },
	{ concurrency: 5, duration: 100, name: "configured batches and local concurrency", worker: { batchSize: 2, localConcurrency: 5 } },
];

integration("PostgreSQL backlog throughput", () => {
	it.each(cases)("drains 30 notification jobs with $name without waiting for polling", async ({ worker, duration, concurrency }) => {
		const Queue = defineQueue({
			name: `backlog-${crypto.randomUUID()}`,
			queue: { notify: true },
			schema: Schema.Struct({ id: Schema.Number }),
			worker: { pollingIntervalSeconds: 10, ...worker },
		});
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss", useListenNotify: true });
		const Jobs = makePgBoss("@test/BacklogJobs");
		const handled: number[] = [];
		let active = 0;
		let peak = 0;
		const live = Jobs.layer({
			clientFactory: () => client,
			jobs: [
				Queue.handle(({ id }) =>
					Effect.gen(function* () {
						active += 1;
						peak = Math.max(peak, active);
						yield* Effect.sleep(duration);
						handled.push(id);
						active -= 1;
					}),
				),
			],
		});
		function drained() {
			return until(async () => {
				const completed = (await client.findJobs(Queue.name)).filter((job) => job.state === "completed");
				return completed.length === 30 ? true : undefined;
			}, 2500);
		}
		await client.start();
		try {
			await client.createQueue(Queue.name, { notify: true });
			await client.insert(
				Queue.name,
				Array.from({ length: 30 }, (_, id) => ({ data: { id } })),
			);
			const started = performance.now();
			const verify = Effect.gen(function* () {
				yield* Jobs;
				yield* Effect.promise(drained);
				expect(performance.now() - started).toBeLessThan(2500);
				expect(new Set(handled).size).toBe(30);
				expect(peak).toBe(concurrency);
			});
			await Effect.runPromise(Effect.scoped(verify.pipe(Effect.provide(live))));
		} finally {
			await client.start();
			await client.deleteQueue(Queue.name);
			await client.deleteQueue(deadLetterQueueName(Queue.name));
			await client.stop();
		}
	});
});
