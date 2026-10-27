import type { PgBoss } from "pg-boss";
import type { ScheduleDefinition } from "#definition.ts";
import { testingOperation } from "#internal/testingReadout.ts";

export function testingSchedules(client: () => PgBoss, changed: () => void) {
	return {
		schedules: () =>
			testingOperation("schedules", async () => (await client().getSchedules()).map(({ name, cron, timezone }) => ({ cron, name, timezone }))),
		trigger: (schedule: Pick<ScheduleDefinition, "name" | "scheduleOptions">) =>
			testingOperation(
				"trigger",
				async () => {
					const [registered] = await client().getSchedules(schedule.name, schedule.scheduleOptions.key ?? "");
					if (registered === undefined) {
						throw new Error("Schedule is not registered");
					}
					await client().send(registered.name, registered.data, { ...registered.options, startAfter: 0 });
					changed();
				},
				schedule.name,
			),
	};
}
