import { Effect, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL per-job settlement", () => {
	it.each(["failure", "defect", "primitive failure"] as const)("isolates one %s in a batch of ten", async (outcome) => {
		const Queue = defineQueue({
			name: `settlement-${crypto.randomUUID()}`,
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
			schema: Schema.Struct({ id: Schema.Number }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss" });
		const Jobs = makePgBoss("@test/SettlementJobs");
		const attempts = new Map<number, number>();
		const failure = new Error(`poison job ${outcome}`);
		const failed = outcome === "defect" ? Effect.die(failure) : Effect.fail(outcome === "primitive failure" ? failure.message : failure);
		const live = Jobs.layer({
			clientFactory: () => client,
			jobs: [
				Queue.handle(({ id }) =>
					Effect.suspend(() => {
						attempts.set(id, (attempts.get(id) ?? 0) + 1);
						return id === 4 ? failed : Effect.void;
					}),
				),
			],
		});
		function settledJobs() {
			return until(async () => {
				const jobs = await client.findJobs<{ id: number }>(Queue.name);
				return jobs.length === 10 && jobs.every((job) => job.state === "completed" || job.state === "failed") ? jobs : undefined;
			});
		}
		await client.start();
		try {
			await client.createQueue(Queue.name, Queue.queueOptions);
			await client.insert(
				Queue.name,
				Array.from({ length: 10 }, (_, id) => ({ data: { id } })),
			);
			await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						yield* Jobs;
						const stored = yield* Effect.promise(settledJobs);
						expect(stored.filter((job) => job.state === "completed")).toHaveLength(9);
						expect(stored.filter((job) => job.state === "failed")).toMatchObject([
							{ data: { id: 4 }, output: { message: failure.message }, retryCount: 1 },
						]);
						for (const job of stored) {
							expect(attempts.get(job.data.id)).toBe(job.data.id === 4 ? 2 : 1);
							expect(job.retryCount).toBe(job.data.id === 4 ? 1 : 0);
						}
					}).pipe(Effect.provide(live)),
				),
			);
		} finally {
			await client.start();
			await client.deleteQueue(Queue.name);
			await client.deleteQueue(deadLetterQueueName(Queue.name));
			await client.stop();
		}
	});
});
