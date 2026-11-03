import { Effect } from "effect";
import type { PgBossClient } from "#server/client.ts";
import { PgBossNotFoundError, toPgBossError } from "#server/error.ts";
import type { PgBossService } from "#server/service.ts";

export function queueAdministration(client: PgBossClient): Pick<PgBossService, "deleteQueue" | "refreshQueueStats" | "unschedule"> {
	return {
		deleteQueue: (queue) =>
			Effect.tryPromise({
				catch: (error) => (error instanceof PgBossNotFoundError ? error : toPgBossError("deleteQueue", error, queue.name)),
				try: async () => {
					if (client.deleteQueue === undefined) {
						throw new TypeError("This pg-boss client does not support deleteQueue");
					}
					if ((await client.getQueue(queue.name)) === null) {
						throw new PgBossNotFoundError({ operation: "deleteQueue", queue: queue.name });
					}
					await client.offWork(queue.name);
					await client.deleteQueue(queue.name);
				},
			}),
		refreshQueueStats: (queue) =>
			Effect.tryPromise({
				catch: (error) => toPgBossError("refreshQueueStats", error, queue?.name),
				try: async () => {
					if (client.supervise === undefined) {
						throw new TypeError("This pg-boss client does not support supervise");
					}
					await client.supervise(queue?.name);
				},
			}),
		unschedule: (schedule) =>
			Effect.tryPromise({
				catch: (error) => (error instanceof PgBossNotFoundError ? error : toPgBossError("unschedule", error, schedule.name)),
				try: async () => {
					if (client.getSchedule === undefined || client.unschedule === undefined) {
						throw new TypeError("This pg-boss client does not support getSchedule and unschedule");
					}
					const key = schedule.scheduleOptions.key ?? "";
					if ((await client.getSchedule(schedule.name, key)) === null) {
						throw new PgBossNotFoundError({ key, operation: "unschedule", queue: schedule.name });
					}
					await client.unschedule(schedule.name, key);
				},
			}),
	};
}
