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

integration("PostgreSQL follow-up jobs", () => {
	it("enqueues from both handlers onto worker and producer queues with one scoped client", async () => {
		const suffix = crypto.randomUUID();
		const Payload = Schema.Struct({ id: Schema.NumberFromString });
		const Source = defineQueue({ name: `source-${suffix}`, queue: { notify: true }, schema: Payload });
		const FollowUp = defineQueue({ name: `follow-up-${suffix}`, queue: { notify: true }, schema: Payload });
		const Producer = defineQueue({ name: `producer-${suffix}`, queue: { notify: true }, schema: Payload });
		const client = new PgBoss({ connectionString: databaseUrl, schema: "platform_effect_pg_boss", useListenNotify: true });
		const factory = vi.fn(() => client);
		const start = vi.spyOn(client, "start");
		const stop = vi.spyOn(client, "stop");
		const Jobs = makePgBoss("@test/FollowUpJobs");
		const completed: number[] = [];
		const live = Jobs.layer({
			clientFactory: factory,
			jobs: [
				Source.handle(({ id }) => Effect.flatMap(Jobs, (jobs) => jobs.enqueue(FollowUp, { id }))),
				FollowUp.handle(({ id }) =>
					Effect.gen(function* () {
						const jobs = yield* Jobs;
						yield* jobs.enqueue(Producer, { id });
						completed.push(id);
					}),
				),
				Producer,
			],
		});
		function chainCompleted(id: string) {
			return until(async () => {
				const source = (await client.findJobs(Source.name, { id }))[0];
				const followUp = (await client.findJobs(FollowUp.name)).find((job) => job.state === "completed");
				return source?.state === "completed" && followUp !== undefined ? true : undefined;
			});
		}
		const cleanup = Effect.promise(async () => {
			for (const queue of [Source, FollowUp, Producer]) {
				await client.offWork(queue.name);
				await client.deleteQueue(queue.name);
				await client.deleteQueue(deadLetterQueueName(queue.name));
			}
		});
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const jobs = yield* Jobs;
					const id = Option.getOrThrow(yield* jobs.enqueue(Source, { id: 42 }));
					yield* Effect.promise(() => chainCompleted(id));
					expect(completed).toEqual([42]);
					const produced = yield* Effect.promise(() => client.findJobs(Producer.name));
					expect(produced).toHaveLength(1);
					expect(produced[0]?.state).toBe("created");
					const producedId = produced[0]?.id;
					expect(producedId).toBeDefined();
					const decoded = Option.getOrThrow(yield* jobs.getJob(Producer, producedId ?? ""));
					expect(decoded.data).toEqual({ id: 42 });
					expect(factory).toHaveBeenCalledTimes(1);
					expect(start).toHaveBeenCalledTimes(1);
				}).pipe(Effect.ensuring(cleanup), Effect.provide(live)),
			),
		);
		expect(stop).toHaveBeenCalledTimes(1);
	});
});
