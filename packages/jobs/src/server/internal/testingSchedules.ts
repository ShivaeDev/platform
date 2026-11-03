import type { ScheduleDefinition } from "#server/definition.ts";
import type { EngineClient } from "#server/engineClient.ts";
import { testingOperation } from "#server/internal/testingReadout.ts";

export function testingSchedules(client: () => EngineClient) {
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
					const id = await client().send(registered.name, registered.data, { ...registered.options, startAfter: 0 });
					return id;
				},
				schedule.name,
			),
	};
}
