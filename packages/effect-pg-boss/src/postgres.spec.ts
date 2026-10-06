import { Effect, Redacted, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossError } from "#error.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL integration", () => {
	it("round-trips transformed payloads and rejects malformed durable data", async () => {
		const queueName = `effect-pg-boss-${crypto.randomUUID()}`;
		const Queue = defineQueue({
			name: queueName,
			queue: { retryLimit: 0 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
		});
		const handled = vi.fn<(id: number) => void>();
		let client: PgBoss | undefined;
		const Jobs = makePgBoss("@test/PostgresJobs");
		const live = Jobs.layer({
			clientFactory: (options) => {
				client = new PgBoss(options);
				return client;
			},
			connectionString: databaseUrl,
			jobs: [Queue.handle(({ id }) => Effect.sync(() => handled(id)))],
			schema: "platform_effect_pg_boss",
		});

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					yield* jobs.enqueue(Queue, { id: 42 });
					yield* Effect.promise(() => until(async () => (handled.mock.calls.length === 1 ? true : undefined)));
					expect(handled).toHaveBeenCalledWith(42);

					if (client === undefined) {
						throw new Error("Client was not created");
					}
					const startedClient = client;
					yield* Effect.promise(() => startedClient.send(queueName, { id: null }));
					const deadLetter = yield* Effect.promise(() =>
						until(async () => {
							const entries = await startedClient.findJobs(deadLetterQueueName(queueName));
							return entries[0];
						}),
					);
					expect(deadLetter.sourceName).toBe(queueName);
					expect(handled).toHaveBeenCalledTimes(1);

					yield* Effect.promise(async () => {
						await startedClient.offWork(queueName);
						await startedClient.deleteQueue(queueName);
						await startedClient.deleteQueue(deadLetterQueueName(queueName));
					});
				}).pipe(Effect.provide(live)),
			),
		);
	}, 20_000);
});

integration("PostgreSQL operational boundaries", () => {
	it("uses the default client and returns zero health counts for externally deleted queues", async () => {
		const queueName = `deleted-health-${crypto.randomUUID()}`;
		const Queue = defineQueue({ name: queueName, schema: Schema.Struct({}) });
		const Jobs = makePgBoss("@test/DeletedHealthJobs");
		const live = Jobs.layer({
			connectionString: databaseUrl,
			jobs: [Queue.handle(() => Effect.void)],
			schema: "platform_effect_pg_boss",
		});
		const admin = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss" });
		await admin.start();
		try {
			await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						const jobs = yield* Jobs;
						yield* Effect.promise(async () => {
							await admin.deleteQueue(queueName);
							await admin.deleteQueue(deadLetterQueueName(queueName));
						});
						expect(yield* jobs.health).toEqual({
							activeTotal: 0,
							deadLetteredTotal: 0,
							failedTotal: 0,
							jobs: [{ activeCount: 0, deadLetteredCount: 0, failedCount: 0, name: queueName, queuedCount: 0, readyCount: 0 }],
							queuedTotal: 0,
							readyTotal: 0,
						});
					}).pipe(Effect.provide(live)),
				),
			);
		} finally {
			await admin.stop();
		}
	}, 20_000);

	it("preserves the operation, queue and pg-boss error after the real database client closes", async () => {
		const queueName = `closed-database-${crypto.randomUUID()}`;
		const Queue = defineQueue({ name: queueName, schema: Schema.Struct({}) });
		const Jobs = makePgBoss("@test/ClosedDatabaseJobs");
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss" });
		const live = Jobs.layer({
			clientFactory: () => client,
			connectionString: databaseUrl,
			jobs: [Queue.handle(() => Effect.void)],
			schema: "platform_effect_pg_boss",
		});
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					yield* Effect.promise(async () => {
						await client.offWork(queueName);
						await client.deleteQueue(queueName);
						await client.deleteQueue(deadLetterQueueName(queueName));
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
						expect(error.queue).toBe(queueName);
						expect(Redacted.value(error.original)).toMatchObject({
							message: "Database not opened. Call open() before executing SQL.",
							name: "AssertionError",
						});
					}
				}).pipe(Effect.provide(live)),
			),
		);
	}, 20_000);
});
