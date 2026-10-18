import { Effect, Redacted, Schema } from "effect";
import { expect, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";
import { boss, realPostgres } from "#test/boss.ts";
import { eventually } from "#test/eventually.ts";
import { postgresConfigured } from "#test/postgresLayer.ts";

boss.it.runIf(postgresConfigured)("round-trips transformed payloads and rejects malformed durable data", [realPostgres], function* ({ boot, admin }) {
	const Queue = defineQueue({ name: "round-trip", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.NumberFromString }) });
	const client = yield* admin();
	const handled = vi.fn<(id: number) => void>();
	const { jobs } = yield* boot([Queue.handle(({ id }) => Effect.sync(() => handled(id)))]);
	yield* jobs.enqueue(Queue, { id: 42 });
	yield* eventually(
		Effect.sync(() => handled.mock.calls),
		(calls) => calls.length === 1,
	);
	expect(handled).toHaveBeenCalledWith(42);
	yield* Effect.promise(() => client.send(Queue.name, { id: null }));
	const deadLetter = yield* eventually(
		Effect.promise(() => client.findJobs(deadLetterQueueName(Queue.name))),
		(entries) => entries.length > 0,
	);
	expect(deadLetter[0]?.sourceName).toBe(Queue.name);
	expect(handled).toHaveBeenCalledTimes(1);
});

boss.it.runIf(postgresConfigured)(
	"uses the default client and returns zero health counts for externally deleted queues",
	[realPostgres],
	function* ({ boot, admin }) {
		const Queue = defineQueue({ name: "deleted-health", schema: Schema.Struct({}) });
		const client = yield* admin();
		const { jobs } = yield* boot([Queue.handle(() => Effect.void)]);
		yield* Effect.promise(async () => {
			await client.deleteQueue(Queue.name);
			await client.deleteQueue(deadLetterQueueName(Queue.name));
		});
		expect(yield* jobs.health).toEqual({
			activeTotal: 0,
			deadLetteredTotal: 0,
			failedTotal: 0,
			jobs: [{ activeCount: 0, deadLetteredCount: 0, failedCount: 0, name: Queue.name, queuedCount: 0, readyCount: 0 }],
			queuedTotal: 0,
			readyTotal: 0,
		});
	},
);

boss.it.runIf(postgresConfigured)(
	"preserves the operation, queue and pg-boss error after the real database client closes",
	[realPostgres],
	function* ({ boot, native }) {
		const Queue = defineQueue({ name: "closed-database", schema: Schema.Struct({}) });
		const client = native();
		const { jobs } = yield* boot([Queue.handle(() => Effect.void)], { clientFactory: () => client });
		yield* Effect.promise(async () => {
			await client.offWork(Queue.name);
			await client.stop();
		});
		for (const [operation, effect] of [
			["enqueue", Effect.asVoid(jobs.enqueue(Queue, {}))],
			["health", Effect.asVoid(jobs.health)],
		] as const) {
			const error = yield* Effect.flip(effect);
			expect(error).toBeInstanceOf(PgBossError);
			if (!(error instanceof PgBossError)) {
				throw error;
			}
			expect(error.operation).toBe(operation);
			expect(error.queue).toBe(Queue.name);
			expect(Redacted.value(error.original)).toMatchObject({
				code: "ERR_ASSERTION",
				message: expect.stringMatching(/^Database not opened\./u),
				name: "AssertionError",
			});
		}
	},
);
