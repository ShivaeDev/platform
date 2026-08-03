import { Effect, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it, vi } from "vitest";
import { deadLetterQueueName, defineQueue, makePgBoss } from "../src/index.js";

const databaseUrl = process.env.PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL;
const integration = databaseUrl === undefined ? describe.skip : describe;

const until = async <A>(
	read: () => Promise<A | undefined>,
	timeoutMilliseconds = 15_000,
): Promise<A> => {
	const deadline = Date.now() + timeoutMilliseconds;
	while (Date.now() < deadline) {
		const value = await read();
		if (value !== undefined) return value;
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	throw new Error("Timed out waiting for pg-boss");
};

integration("PostgreSQL integration", () => {
	it("round-trips transformed payloads and rejects malformed durable data", async () => {
		const queueName = `effect-pg-boss-${process.pid}-${Date.now()}`;
		const Queue = defineQueue({
			name: queueName,
			queue: { retryLimit: 0 },
			schema: Schema.Struct({ id: Schema.NumberFromString }),
		});
		const handled = vi.fn<(id: number) => void>();
		let client: PgBoss | undefined;
		const Jobs = makePgBoss("@test/PostgresJobs");
		const live = Jobs.layer({
			connectionString: databaseUrl,
			clientFactory: (options) => {
				client = new PgBoss(options);
				return client;
			},
			jobs: [Queue.handle(({ id }) => Effect.sync(() => handled(id)))],
			schema: "platform_effect_pg_boss",
		});

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					yield* jobs.enqueue(Queue, { id: 42 });
					yield* Effect.promise(() =>
						until(async () =>
							handled.mock.calls.length === 1 ? true : undefined,
						),
					);
					expect(handled).toHaveBeenCalledWith(42);

					if (client === undefined) throw new Error("Client was not created");
					const startedClient = client;
					yield* Effect.promise(() =>
						startedClient.send(queueName, { id: null }),
					);
					const deadLetter = yield* Effect.promise(() =>
						until(async () => {
							const entries = await startedClient.findJobs(
								deadLetterQueueName(queueName),
							);
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
