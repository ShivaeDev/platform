import { Effect } from "effect";
import type { ScheduleDefinition } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { admin } from "#test/postgres/engine.ts";

export function scheduledOutside(schedule: ScheduleDefinition) {
	return database.trait("jobs", `an earlier client registered ${schedule.name} with key ${schedule.scheduleOptions.key ?? ""}`, function* (engine) {
		const client = yield* admin(engine);
		yield* Effect.promise(() => client.schedule(schedule.name, schedule.cron, undefined, schedule.scheduleOptions));
	});
}
