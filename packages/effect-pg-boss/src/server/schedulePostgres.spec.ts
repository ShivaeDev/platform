import { Effect } from "effect";
import { PgBoss } from "pg-boss";
import { describe, expect, it } from "vitest";
import { defineSchedule } from "#definition.ts";
import { makePgBoss } from "#service.ts";
import { environmentVariable } from "#test/environment.ts";

const databaseUrl = environmentVariable("PLATFORM_EFFECT_PG_BOSS_TEST_DATABASE_URL") ?? "";
const integration = databaseUrl === "" ? describe.skip : describe;

integration("PostgreSQL schedule registration", () => {
	it("stores the cron with explicit UTC options, default retries and a dead-letter queue", async () => {
		const Schedule = defineSchedule({ cron: "17 3 * * *", name: `schedule-${crypto.randomUUID()}` });
		const deadLetter = `${Schedule.name}-dlq`;
		const options = { connectionString: databaseUrl, schema: "platform_effect_pg_boss" };
		const client = new PgBoss(options);
		const Jobs = makePgBoss("@test/ScheduleRegistration");

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					yield* Jobs;
					yield* Effect.promise(async () => {
						expect(await client.getSchedules(Schedule.name)).toMatchObject([
							{ cron: "17 3 * * *", name: Schedule.name, options: { tz: "UTC" }, timezone: "UTC" },
						]);
						expect(await client.getQueue(Schedule.name)).toMatchObject({ deadLetter, name: Schedule.name, retryBackoff: true, retryLimit: 3 });
						expect(await client.getQueue(deadLetter)).toMatchObject({ name: deadLetter });
					});
				}).pipe(
					Effect.ensuring(
						Effect.promise(async () => {
							await client.unschedule(Schedule.name);
							await client.offWork(Schedule.name);
							await client.deleteQueue(Schedule.name);
							await client.deleteQueue(deadLetter);
						}),
					),
					Effect.provide(Jobs.layer({ ...options, clientFactory: () => client, jobs: [Schedule.run(Effect.void)] })),
				),
			),
		);
	});
});
