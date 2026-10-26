import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("reports both populated queues and their totals after the monitor refreshes", [realPostgres], function* ({ boot, admin, native, until }) {
	const queues = [1, 2].map((count) => ({
		activeCount: count,
		deadLetteredCount: count,
		failedCount: count,
		queue: defineQueue({ name: `health-${count}`, queue: { retryLimit: 0 }, schema: Schema.Struct({}) }),
		queuedCount: 3,
		readyCount: 3 - count,
	}));
	const client = yield* admin();
	const observed = native({ monitorIntervalSeconds: 1, superviseIntervalSeconds: 1 });
	const { jobs } = yield* boot(
		queues.map(({ queue }) => queue),
		{ clientFactory: () => observed },
	);
	for (const { queue, activeCount, failedCount, readyCount } of queues) {
		yield* Effect.promise(async () => {
			for (let index = 0; index < failedCount; index += 1) {
				await client.send(queue.name, {});
			}
			const failed = await client.fetch(queue.name, { batchSize: failedCount, includeMetadata: true });
			await client.fail(queue.name, failed, new Error("Retained health failure"));
			for (let index = 0; index < activeCount; index += 1) {
				await client.send(queue.name, {});
			}
			await client.fetch(queue.name, { batchSize: activeCount });
			for (let index = 0; index < 3; index += 1) {
				await client.send(queue.name, {}, index < readyCount ? {} : { startAfter: 3600 });
			}
		});
	}
	const health = yield* until(
		jobs.health,
		(value) => value.failedTotal === 3 && value.activeTotal === 3 && value.deadLetteredTotal === 3 && value.queuedTotal === 6,
	);
	expect(health).toEqual({
		activeTotal: 3,
		deadLetteredTotal: 3,
		failedTotal: 3,
		jobs: queues.map(({ queue, ...counts }) => ({ ...counts, name: queue.name })),
		queuedTotal: 6,
		readyTotal: 3,
	});
});
