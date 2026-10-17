import { Effect, Option, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";
import { untilWorker } from "#test/untilWorker.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL notification and live counts", () => {
	it("wakes a waiting worker before its poll and reports a drain immediately after completion", async () => {
		const Queue = defineQueue({
			name: `notify-${crypto.randomUUID()}`,
			queue: { heartbeatSeconds: 10, notify: true, partition: true, policy: "standard", warningQueueSize: 100 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 10 },
		});
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss", useListenNotify: true });
		const release = Promise.withResolvers<void>();
		const handled: number[] = [];
		const Jobs = makePgBoss("@test/NotifyJobs");
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					yield* Effect.promise(() => untilWorker(client, Queue.name));
					const id = Option.getOrThrow(yield* jobs.enqueue(Queue, { id: 42 }));
					yield* Effect.promise(() => until(async () => (handled.length === 1 ? true : undefined), 1500));
					expect(handled).toEqual([42]);
					expect(yield* jobs.counts(Queue)).toEqual({ activeCount: 1, failedCount: 0, queuedCount: 0, totalCount: 1 });
					expect((yield* jobs.health).activeTotal).toBe(0);
					release.resolve();
					yield* Effect.promise(() => until(async () => ((await client.findJobs(Queue.name, { id }))[0]?.state === "completed" ? true : undefined)));
					expect(yield* jobs.counts(Queue)).toEqual({ activeCount: 0, failedCount: 0, queuedCount: 0, totalCount: 1 });
				}).pipe(
					Effect.ensuring(
						Effect.promise(async () => {
							release.resolve();
							await client.offWork(Queue.name);
							await client.deleteQueue(Queue.name);
							await client.deleteQueue(deadLetterQueueName(Queue.name));
						}),
					),
					Effect.provide(
						Jobs.layer({
							clientFactory: () => client,
							connectionString: databaseUrl,
							jobs: [Queue.handle(({ id }) => Effect.sync(() => handled.push(id)).pipe(Effect.andThen(Effect.promise(() => release.promise))))],
							schema: "platform_effect_pg_boss",
						}),
					),
				),
			),
		);
	});
});
