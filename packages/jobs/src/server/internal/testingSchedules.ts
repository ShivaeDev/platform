import { Effect, Redacted } from "effect";
import type { PgBossClient } from "#server/client.ts";
import type { ScheduleDefinition } from "#server/definition.ts";
import { PgBossTestingError } from "#server/error.ts";
import type { PgBossInspectionService } from "#server/inspection.ts";
import { testingInspection, testingOperation } from "#server/internal/testingOperation.ts";

export function testingSchedules(client: () => PgBossClient, inspection: () => PgBossInspectionService) {
	return {
		schedules: () =>
			Effect.suspend(() => testingInspection("schedules", inspection().schedules())).pipe(
				Effect.map((schedules) => schedules.map(({ name, cron, timezone }) => ({ cron, name, timezone }))),
			),
		trigger: (schedule: Pick<ScheduleDefinition, "name" | "scheduleOptions">) =>
			Effect.gen(function* () {
				const [registered] = yield* testingInspection(
					"trigger",
					inspection().schedules(schedule.name, schedule.scheduleOptions.key ?? ""),
					schedule.name,
				);
				if (registered === undefined) {
					return yield* new PgBossTestingError({
						operation: "trigger",
						original: Redacted.make(new Error("Schedule is not registered")),
						queue: schedule.name,
					});
				}
				return yield* testingOperation(
					"trigger",
					() => client().send(registered.name, registered.data, { ...registered.options, startAfter: 0 }),
					schedule.name,
				);
			}),
	};
}
