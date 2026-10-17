import { Effect, Option, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL job control", () => {
	it.each(["failed", "retry"] as const)("looks up and retries a %s job under its original ID", async (state) => {
		const Queue = defineQueue({
			name: `control-${crypto.randomUUID()}`,
			queue: { retryBackoff: false, retryDelay: 3600, retryLimit: state === "failed" ? 0 : 1 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
			worker: { pollingIntervalSeconds: 0.5 },
		});
		const options = { connectionString: databaseUrl, schema: "platform_effect_pg_boss" };
		const client = new PgBoss(options);
		const Jobs = makePgBoss("@test/JobControl");
		const handled: number[] = [];
		const worker = Queue.handle(({ id }) =>
			Effect.suspend(() => {
				handled.push(id);
				return handled.length === 1 ? Effect.fail(new Error("Try again")) : Effect.void;
			}),
		);
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					const id = crypto.randomUUID();
					expect(Option.isNone(yield* jobs.getJob(Queue, id))).toBe(true);
					expect(Option.getOrThrow(yield* jobs.enqueue(Queue, { id: 42 }, { id }))).toBe(id);
					const failed = yield* Effect.promise(() =>
						until(async () => {
							const found = Option.getOrUndefined(await Effect.runPromise(jobs.getJob(Queue, id)));
							return found?.state === state ? found : undefined;
						}),
					);
					expect(failed).toMatchObject({ data: { id: 42 }, id, state });
					expect(Option.isNone(yield* jobs.enqueue(Queue, { id: 42 }, { id }))).toBe(true);
					expect(yield* jobs.counts(Queue)).toMatchObject({
						activeCount: 0,
						failedCount: state === "failed" ? 1 : 0,
						queuedCount: state === "retry" ? 1 : 0,
					});
					yield* jobs.retry(Queue, id);
					const completed = yield* Effect.promise(() =>
						until(async () => {
							const found = Option.getOrUndefined(await Effect.runPromise(jobs.getJob(Queue, id)));
							return found?.state === "completed" ? found : undefined;
						}),
					);
					expect(completed).toMatchObject({ data: { id: 42 }, id, state: "completed" });
					expect(handled).toEqual([42, 42]);
				}).pipe(
					Effect.ensuring(
						Effect.promise(async () => {
							await client.offWork(Queue.name);
							await client.deleteQueue(Queue.name);
							await client.deleteQueue(deadLetterQueueName(Queue.name));
						}),
					),
					Effect.provide(Jobs.layer({ ...options, clientFactory: () => client, jobs: [worker] })),
				),
			),
		);
	});
});
