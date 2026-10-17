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

integration("PostgreSQL cached health", () => {
	it("reports both populated queues and their totals after the monitor refreshes", async () => {
		const queues = [1, 2].map((count) => ({
			activeCount: count,
			deadLetteredCount: count,
			failedCount: count,
			queue: defineQueue({ name: `health-${crypto.randomUUID()}`, queue: { retryLimit: 0 }, schema: Schema.Struct({}) }),
			queuedCount: 3,
			readyCount: 3 - count,
		}));
		const options = {
			connectionString: databaseUrl,
			monitorIntervalSeconds: 1,
			schema: "platform_effect_pg_boss_health",
			superviseIntervalSeconds: 1,
		};
		const client = new PgBoss(options);
		const Jobs = makePgBoss("@test/PopulatedHealth");
		async function populateQueue({ queue, activeCount, failedCount, readyCount }: (typeof queues)[number]) {
			for (let index = 0; index < failedCount; index += 1) {
				await client.send(queue.name, {});
			}
			const failed = await client.fetch(queue.name, { batchSize: failedCount, includeMetadata: true });
			expect(failed).toHaveLength(failedCount);
			await client.fail(queue.name, failed, new Error("Retained health failure"));
			for (let index = 0; index < activeCount; index += 1) {
				await client.send(queue.name, {});
			}
			expect(await client.fetch(queue.name, { batchSize: activeCount })).toHaveLength(activeCount);
			for (let index = 0; index < 3; index += 1) {
				await client.send(queue.name, {}, index < readyCount ? {} : { startAfter: 3600 });
			}
		}
		async function removeQueues() {
			for (const { queue } of queues) {
				await client.deleteQueue(queue.name);
				await client.deleteQueue(deadLetterQueueName(queue.name));
			}
		}
		const expected = {
			activeTotal: 3,
			deadLetteredTotal: 3,
			failedTotal: 3,
			jobs: queues.map(({ queue, ...counts }) => ({ ...counts, name: queue.name })),
			queuedTotal: 6,
			readyTotal: 3,
		};

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					for (const queue of queues) {
						yield* Effect.promise(() => populateQueue(queue));
					}
					yield* Effect.promise(() =>
						until(async () => {
							const health = await Effect.runPromise(jobs.health);
							expect(health).toEqual(expected);
							return health;
						}),
					);
				}).pipe(
					Effect.ensuring(Effect.promise(removeQueues)),
					Effect.provide(Jobs.layer({ ...options, clientFactory: () => client, jobs: queues.map(({ queue }) => queue) })),
				),
			),
		);
	});
});
