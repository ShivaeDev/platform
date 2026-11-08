import { Effect, Redacted } from "effect";
import type { PgBossClient } from "@shivaedev/jobs/server/adapters/client.ts";
import type { ScheduleDefinition } from "@shivaedev/jobs/server/definition.ts";
import type { PgBossInspectionService } from "@shivaedev/jobs/server/inspection.ts";
import { testingOperation } from "#jobs/adapters/testingOperation.ts";
import { PgBossTestingError } from "#jobs/error.ts";
import { testingInspection } from "#jobs/testingInspection.ts";

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
