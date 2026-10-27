import { Effect } from "effect";
import { expect } from "vitest";
import { defineSchedule } from "#definition.ts";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("stores the cron with explicit UTC options, default retries and a dead-letter queue", [realPostgres], function* ({ boot, admin }) {
	const Schedule = defineSchedule({ cron: "17 3 * * *", name: "scheduled" });
	const client = yield* admin();
	yield* boot([Schedule.run(Effect.void)]);
	expect(yield* Effect.promise(() => client.getSchedules(Schedule.name))).toMatchObject([
		{ cron: "17 3 * * *", name: Schedule.name, options: { tz: "UTC" }, timezone: "UTC" },
	]);
	expect(yield* Effect.promise(() => client.getQueue(Schedule.name))).toMatchObject({
		deadLetter: `${Schedule.name}-dlq`,
		name: Schedule.name,
		retryBackoff: true,
		retryLimit: 3,
	});
	expect(yield* Effect.promise(() => client.getQueue(`${Schedule.name}-dlq`))).toMatchObject({ name: `${Schedule.name}-dlq` });
});
