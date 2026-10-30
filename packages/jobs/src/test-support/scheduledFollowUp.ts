import { Effect, Schema } from "effect";
import { defineQueue, defineSchedule } from "#definition.ts";
import { Jobs, type pgBossRuntime } from "#test/pgBossRuntime.ts";
import { makePgBossTesting } from "#testing.ts";

export function scheduledFollowUp(runtime: ReturnType<typeof pgBossRuntime>) {
	const testing = makePgBossTesting();
	const delivered: string[] = [];
	const target = defineQueue({ name: "scheduled-follow-up", schema: Schema.Struct({ message: Schema.String }) });
	const schedule = defineSchedule({ cron: "0 * * * *", name: "publish-follow-up" });
	return {
		deliveredMessages: () => Effect.sync(() => [...delivered]),
		start: (message: string) =>
			runtime.boot(
				[
					schedule.run(Effect.flatMap(Jobs, (jobs) => jobs.enqueue(target, { message }))),
					target.handle((payload) => Effect.sync(() => delivered.push(payload.message))),
				],
				{ clientFactory: testing.clientFactory, schedule: false },
			),
		trigger: () => testing.trigger(schedule),
		waitForDelivery: () => testing.waitForIdle,
	};
}
