import type { DefineScheduleOptions, ScheduleDefinition } from "#definition.ts";
import { maxDeferrals, nativeQueueOptions } from "#internal/definitionOptions.ts";

export function defineSchedule<const TName extends string>(options: DefineScheduleOptions<TName>): ScheduleDefinition<TName> {
	const definition: ScheduleDefinition<TName> = {
		_tag: "ScheduleDefinition",
		cron: options.cron,
		maxDeferrals: maxDeferrals(options.queue),
		name: options.name,
		queueOptions: nativeQueueOptions(options.queue),
		run: (effect) =>
			Object.freeze({
				_tag: "ScheduledWorker" as const,
				effect,
				schedule: definition,
			}),
		scheduleOptions: Object.freeze({ tz: "UTC", ...options.schedule }),
		workerOptions: Object.freeze({ batchSize: 10, burstWhenBatchFull: true, ...options.worker }),
	};
	return Object.freeze(definition);
}
