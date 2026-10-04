import { Context, Effect, Layer, Option, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { deadLetterQueueName, defineQueue, defineSchedule, makePgBoss, PgBossPayloadError } from "#index.ts";
import { constructorOptions, FakeClient, job, queueResult } from "#test/support/fake-client.ts";

class Prefix extends Context.Service<Prefix, string>()("@test/Prefix") {}

describe("pg-boss service", () => {
	it("registers typed queues and UTC schedules with retries and dead letters", async () => {
		const client = new FakeClient();
		const handled: string[] = [];
		const Emails = defineQueue({
			name: "emails",
			queue: { retryLimit: 5 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
		});
		const Cleanup = defineSchedule({
			cron: "17 3 * * *",
			name: "cleanup",
		});
		const Jobs = makePgBoss("@test/Jobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientFactory: () => client,
			jobs: [
				Emails.handle((payload, context) =>
					Effect.map(Prefix, (prefix) => {
						handled.push(`${prefix}:${payload.id}:${context.id}`);
					}),
				),
				Cleanup.run(Effect.map(Prefix, (prefix) => handled.push(prefix))),
			],
		}).pipe(Layer.provide(Layer.succeed(Prefix, "captured")));

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					const id = yield* jobs.enqueue(Emails, { id: 42 });
					expect(Option.getOrUndefined(id)).toBe("job-id");
					expect(client.sendCalls).toEqual([{ data: { id: "42" }, name: "emails", options: undefined }]);

					yield* Effect.promise(() => client.workers[0]?.run([job("emails", { id: "7" })]) ?? Promise.resolve());
					yield* Effect.promise(() => client.workers[1]?.run([job("cleanup", null)]) ?? Promise.resolve());
					expect(handled).toEqual(["captured:7:job-emails", "captured"]);
				}).pipe(Effect.provide(live)),
			),
		);

		expect(client.startCalls).toBe(1);
		expect(client.stopCalls).toBe(1);
		expect(client.createQueueCalls).toEqual([
			{ name: deadLetterQueueName("emails"), options: undefined },
			{
				name: "emails",
				options: {
					deadLetter: deadLetterQueueName("emails"),
					retryBackoff: true,
					retryLimit: 5,
				},
			},
			{ name: deadLetterQueueName("cleanup"), options: undefined },
			{
				name: "cleanup",
				options: {
					deadLetter: deadLetterQueueName("cleanup"),
					retryBackoff: true,
					retryLimit: 3,
				},
			},
		]);
		expect(client.scheduleCalls).toEqual([
			{
				cron: "17 3 * * *",
				data: null,
				name: "cleanup",
				options: { tz: "UTC" },
			},
		]);
	});

	it("rejects malformed durable payloads before domain code runs", async () => {
		const client = new FakeClient();
		const handler = vi.fn(() => Effect.void);
		const Queue = defineQueue({
			name: "typed",
			schema: Schema.Struct({ count: Schema.Number }),
		});
		const Jobs = makePgBoss("@test/InvalidPayloadJobs");

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Jobs;
					yield* Effect.promise(() => expect(client.workers[0]?.run([job("typed", { count: "wrong" })])).rejects.toBeInstanceOf(PgBossPayloadError));
				}).pipe(
					Effect.provide(
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [Queue.handle(handler)],
						}),
					),
				),
			),
		);

		expect(handler).not.toHaveBeenCalled();
	});

	it("projects queue and dead-letter health concurrently", async () => {
		const client = new FakeClient();
		const Queue = defineQueue({ name: "health", schema: Schema.Struct({}) });
		client.queues.set(
			"health",
			queueResult("health", {
				activeCount: 2,
				failedCount: 3,
				queuedCount: 7,
				readyCount: 5,
			}),
		);
		client.queues.set(deadLetterQueueName("health"), queueResult(deadLetterQueueName("health"), { queuedCount: 4 }));
		const Jobs = makePgBoss("@test/HealthJobs");

		const health = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					return yield* jobs.health;
				}).pipe(
					Effect.provide(
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [Queue.handle(() => Effect.void)],
						}),
					),
				),
			),
		);

		expect(health).toMatchObject({
			activeTotal: 2,
			deadLetteredTotal: 4,
			failedTotal: 3,
			queuedTotal: 7,
			readyTotal: 5,
		});
	});
});
