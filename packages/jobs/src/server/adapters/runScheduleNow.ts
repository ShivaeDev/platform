import { Effect, Option } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { PgBossNotFoundError, toPgBossError } from "#server/error.ts";
import type { PgBossService } from "#server/service.ts";

export function runScheduleNow(client: PgBossClient, schedule: Parameters<PgBossService["runScheduleNow"]>[0]) {
	const key = schedule.scheduleOptions.key ?? "";
	return Effect.tryPromise({
		catch: (error) => (error instanceof PgBossNotFoundError ? error : toPgBossError("runScheduleNow", error, schedule.name)),
		try: async () => {
			if (client.getSchedules === undefined) {
				throw new TypeError("This pg-boss client does not support getSchedules");
			}
			const [registered] = await client.getSchedules(schedule.name, key);
			if (registered === undefined) {
				throw new PgBossNotFoundError({ key, operation: "runScheduleNow", queue: schedule.name });
			}
			return Option.fromNullishOr(await client.send(registered.name, registered.data, { ...registered.options, startAfter: 0 }));
		},
	});
}
