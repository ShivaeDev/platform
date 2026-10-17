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

integration("PostgreSQL producers", () => {
	it("creates producer queues and dead-letters an encoded job after the worker exhausts retries", async () => {
		const Queue = defineQueue({
			name: `producer-${crypto.randomUUID()}`,
			queue: { retryBackoff: false, retryDelay: 0, retryLimit: 2 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const deadLetter = deadLetterQueueName(Queue.name);
		const options = { connectionString: databaseUrl, schema: "platform_effect_pg_boss" };
		const client = new PgBoss(options);
		const Producer = makePgBoss("@test/PostgresProducer");
		const Worker = makePgBoss("@test/PostgresWorker");
		const handled = vi.fn<(id: number) => void>();
		const worker = Queue.handle(({ id }) => Effect.sync(() => handled(id)).pipe(Effect.andThen(Effect.fail(new Error("Retry this job")))));

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const producer = yield* Producer;
					expect(yield* Effect.promise(() => client.getQueue(Queue.name))).toMatchObject({ deadLetter, retryLimit: 2 });
					expect(yield* Effect.promise(() => client.getQueue(deadLetter))).toMatchObject({ name: deadLetter });
					const jobId = Option.getOrThrow(yield* producer.enqueue(Queue, { id: 42 }));
					expect(yield* Effect.promise(() => client.findJobs(Queue.name))).toMatchObject([{ data: { id: "42" }, id: jobId, state: "created" }]);
					expect(handled).not.toHaveBeenCalled();

					const deadJob = yield* Effect.scoped(
						Effect.promise(() => until(async () => (await client.findJobs(deadLetter))[0])).pipe(
							Effect.provide(Worker.layer({ ...options, jobs: [worker] })),
						),
					);
					expect(deadJob).toMatchObject({ data: { id: "42" }, sourceId: jobId, sourceName: Queue.name });
					expect(handled.mock.calls).toEqual([[42], [42], [42]]);
					expect(yield* Effect.promise(() => client.findJobs(Queue.name))).toMatchObject([{ id: jobId, retryCount: 2, state: "failed" }]);
				}).pipe(
					Effect.ensuring(
						Effect.promise(async () => {
							await client.deleteQueue(Queue.name);
							await client.deleteQueue(deadLetter);
						}),
					),
					Effect.provide(Producer.layer({ ...options, clientFactory: () => client, jobs: [Queue] })),
				),
			),
		);
	});
});
