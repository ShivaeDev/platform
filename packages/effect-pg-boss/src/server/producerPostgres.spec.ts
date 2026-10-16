import { Effect, Option, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL producer queues", () => {
	it("creates producer queues, encodes a job and dead-letters it after the separate worker exhausts retries", async () => {
		const Queue = defineQueue({
			name: `producer-${crypto.randomUUID()}`,
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const Jobs = makePgBoss("@test/ProducerPostgresJobs");
		const options = { connectionString: databaseUrl, schema: "platform_effect_pg_boss" };
		const admin = new PgBoss(options);
		await admin.start();
		try {
			const jobId = await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						const jobs = yield* Jobs;
						expect(yield* Effect.promise(() => admin.getQueue(Queue.name))).toMatchObject({
							deadLetter: deadLetterQueueName(Queue.name),
							retryBackoff: false,
							retryLimit: 1,
						});
						expect(yield* Effect.promise(() => admin.getQueue(deadLetterQueueName(Queue.name)))).not.toBeNull();
						const id = Option.getOrThrow(yield* jobs.enqueue(Queue, { id: 42 }));
						expect(yield* Effect.promise(() => admin.getJobById(Queue.name, id))).toMatchObject({ data: { id: "42" }, state: "created" });
						return id;
					}).pipe(Effect.provide(Jobs.layer({ ...options, jobs: [Queue] }))),
				),
			);
			const attempts = vi.fn<(id: number) => void>();
			const worker = Queue.handle(({ id }) => Effect.sync(() => attempts(id)).pipe(Effect.andThen(Effect.fail("retry me"))));
			await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						const deadLetter = yield* Effect.promise(() => until(async () => (await admin.findJobs(deadLetterQueueName(Queue.name)))[0]));
						expect(deadLetter).toMatchObject({ data: { id: "42" }, sourceName: Queue.name });
						expect(attempts.mock.calls).toEqual([[42], [42]]);
						expect(yield* Effect.promise(() => admin.getJobById(Queue.name, jobId))).toMatchObject({ retryCount: 1, state: "failed" });
					}).pipe(Effect.provide(Jobs.layer({ ...options, jobs: [worker] }))),
				),
			);
		} finally {
			await admin.deleteQueue(Queue.name);
			await admin.deleteQueue(deadLetterQueueName(Queue.name));
			await admin.stop();
		}
	});
});
