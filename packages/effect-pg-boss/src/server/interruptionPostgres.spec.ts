import { Effect, Schema } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";
import { until } from "#test/until.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL interrupted batch settlement", () => {
	it("keeps completed jobs and leaves the interrupted and remaining jobs active until expiry", async () => {
		const Queue = defineQueue({
			name: `interrupted-${crypto.randomUUID()}`,
			queue: { expireInSeconds: 3, retryLimit: 0 },
			schema: Schema.Struct({ id: Schema.Number }),
		});
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss" });
		const Jobs = makePgBoss("@test/InterruptedPostgresJobs");
		const interrupted = Promise.withResolvers<void>();
		const handled: number[] = [];
		const live = Jobs.layer({
			clientFactory: () => client,
			jobs: [
				Queue.handle(({ id }) =>
					Effect.suspend(() => {
						handled.push(id);
						if (handled.length === 2) {
							interrupted.resolve();
							return Effect.interrupt;
						}
						return Effect.void;
					}),
				),
			],
		});
		function expiredJobs() {
			return until(async () => {
				const jobs = await client.findJobs(Queue.name);
				return jobs.filter((job) => job.state === "failed").length === 2 ? jobs : undefined;
			});
		}
		await client.start();
		try {
			await client.createQueue(Queue.name, Queue.queueOptions);
			await client.insert(
				Queue.name,
				Array.from({ length: 3 }, (_, id) => ({ data: { id } })),
			);
			await Effect.runPromise(
				Effect.scoped(
					Effect.gen(function* () {
						yield* Jobs;
						yield* Effect.promise(() => interrupted.promise);
						const active = yield* Effect.promise(() => client.findJobs(Queue.name));
						expect(active.filter((job) => job.state === "completed")).toMatchObject([{ data: { id: handled[0] }, retryCount: 0 }]);
						expect(active.filter((job) => job.state === "active")).toHaveLength(2);
						const expired = yield* Effect.promise(expiredJobs);
						expect(expired.filter((job) => job.state === "completed")).toMatchObject([{ data: { id: handled[0] }, retryCount: 0 }]);
						expect(expired.filter((job) => job.state === "failed").map((job) => job.output)).toMatchObject([
							{ message: "handler execution exceeded 3s" },
							{ message: "handler execution exceeded 3s" },
						]);
						expect(handled).toHaveLength(2);
					}).pipe(Effect.provide(live)),
				),
			);
		} finally {
			await client.start();
			await client.deleteQueue(Queue.name);
			await client.deleteQueue(deadLetterQueueName(Queue.name));
			await client.stop();
		}
	});
});
