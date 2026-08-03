import { Context, Effect, Layer, Option, Schema } from "effect";
import type {
	ConstructorOptions,
	Job,
	Queue,
	QueueResult,
	ScheduleOptions,
	SendOptions,
	StopOptions,
	WorkOptions,
} from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import {
	deadLetterQueueName,
	defineQueue,
	defineSchedule,
	makePgBoss,
	PgBossError,
	PgBossPayloadError,
} from "../src/index.js";
import type { PgBossClient } from "../src/internal/client.js";

interface QueueCall {
	readonly name: string;
	readonly options?: Omit<Queue, "name">;
}

interface WorkerCall {
	readonly name: string;
	readonly options: WorkOptions;
	readonly run: (jobs: readonly Job<unknown>[]) => Promise<unknown>;
}

class FakeClient implements PgBossClient {
	readonly createQueueCalls: QueueCall[] = [];
	readonly offWorkCalls: string[] = [];
	readonly scheduleCalls: Array<{
		readonly cron: string;
		readonly data?: object | null;
		readonly name: string;
		readonly options?: ScheduleOptions;
	}> = [];
	readonly sendCalls: Array<{
		readonly data?: object | null;
		readonly name: string;
		readonly options?: SendOptions;
	}> = [];
	readonly workers: WorkerCall[] = [];
	readonly errors: Array<(error: Error) => void> = [];
	readonly queues = new Map<string, QueueResult>();
	startCalls = 0;
	failStart = false;
	stopCalls = 0;
	failCreateQueue = false;

	async createQueue(name: string, options?: Omit<Queue, "name">) {
		if (this.failCreateQueue) throw new Error("queue unavailable");
		this.createQueueCalls.push({ name, options });
	}
	async getQueue(name: string) {
		return this.queues.get(name) ?? null;
	}
	async offWork(name: string) {
		this.offWorkCalls.push(name);
	}
	on(_event: "error", listener: (error: Error) => void) {
		this.errors.push(listener);
		return this;
	}
	off(_event: "error", listener: (error: Error) => void) {
		const index = this.errors.indexOf(listener);
		if (index >= 0) this.errors.splice(index, 1);
		return this;
	}
	async schedule(
		name: string,
		cron: string,
		data?: object | null,
		options?: ScheduleOptions,
	) {
		this.scheduleCalls.push({ cron, data, name, options });
	}
	async send(name: string, data?: object | null, options?: SendOptions) {
		this.sendCalls.push({ data, name, options });
		return "job-id";
	}
	async start() {
		this.startCalls += 1;
		if (this.failStart) throw new Error("start unavailable");
		return this;
	}
	async stop(_options?: StopOptions) {
		this.stopCalls += 1;
	}
	async work<Payload>(
		name: string,
		options: WorkOptions,
		handler: (jobs: readonly Job<Payload>[]) => Promise<unknown>,
	) {
		this.workers.push({
			name,
			options,
			run: handler as (jobs: readonly Job<unknown>[]) => Promise<unknown>,
		});
		return `worker-${name}`;
	}
}

const job = (name: string, data: unknown): Job<unknown> => ({
	data,
	expireInSeconds: 900,
	heartbeatSeconds: null,
	id: `job-${name}`,
	name,
	signal: new AbortController().signal,
});

const queueResult = (
	name: string,
	counts: Partial<QueueResult>,
): QueueResult => ({
	activeCount: 0,
	createdOn: new Date(0),
	deferredCount: 0,
	failedCount: 0,
	name,
	queuedCount: 0,
	readyCount: 0,
	singletonsActive: null,
	table: name,
	totalCount: 0,
	updatedOn: new Date(0),
	...counts,
});

const constructorOptions: ConstructorOptions = {
	connectionString: "postgresql://compile-only",
	schema: "jobs_test",
};

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
					expect(client.sendCalls).toEqual([
						{ data: { id: "42" }, name: "emails", options: undefined },
					]);

					yield* Effect.promise(
						() =>
							client.workers[0]?.run([job("emails", { id: "7" })]) ??
							Promise.resolve(),
					);
					yield* Effect.promise(
						() =>
							client.workers[1]?.run([job("cleanup", null)]) ??
							Promise.resolve(),
					);
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
					yield* Effect.promise(() =>
						expect(
							client.workers[0]?.run([job("typed", { count: "wrong" })]),
						).rejects.toBeInstanceOf(PgBossPayloadError),
					);
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
		client.queues.set(
			deadLetterQueueName("health"),
			queueResult(deadLetterQueueName("health"), { queuedCount: 4 }),
		);
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

	it("reuses and reference-counts a development client", async () => {
		const client = new FakeClient();
		const factory = vi.fn(() => client);
		const Queue = defineQueue({ name: "cached", schema: Schema.Struct({}) });
		const Jobs = makePgBoss("@test/CachedJobs");
		const live = Jobs.layer({
			...constructorOptions,
			clientFactory: factory,
			developmentCacheKey: Symbol("cached-jobs"),
			jobs: [Queue.handle(() => Effect.void)],
		});

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Layer.build(live);
					yield* Layer.build(live);
					expect(client.stopCalls).toBe(0);
				}),
			),
		);

		expect(factory).toHaveBeenCalledTimes(1);
		expect(client.startCalls).toBe(1);
		expect(client.offWorkCalls).toEqual(["cached"]);
		expect(client.stopCalls).toBe(1);
	});

	it("closes a started client when registration fails", async () => {
		const client = new FakeClient();
		client.failCreateQueue = true;
		const Queue = defineQueue({ name: "broken", schema: Schema.Struct({}) });
		const Jobs = makePgBoss("@test/BrokenJobs");

		await expect(
			Effect.runPromise(
				Effect.scoped(
					Effect.provide(
						Effect.asVoid(Jobs),
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [Queue.handle(() => Effect.void)],
						}),
					),
				),
			),
		).rejects.toBeInstanceOf(PgBossError);
		expect(client.startCalls).toBe(1);
		expect(client.stopCalls).toBe(1);
	});

	it("closes a partially acquired client when startup fails", async () => {
		const client = new FakeClient();
		client.failStart = true;
		const Jobs = makePgBoss("@test/StartFailureJobs");

		await expect(
			Effect.runPromise(
				Effect.scoped(
					Effect.provide(
						Effect.asVoid(Jobs),
						Jobs.layer({
							...constructorOptions,
							clientFactory: () => client,
							jobs: [],
						}),
					),
				),
			),
		).rejects.toBeInstanceOf(PgBossError);
		expect(client.startCalls).toBe(1);
		expect(client.stopCalls).toBe(1);
	});
});
