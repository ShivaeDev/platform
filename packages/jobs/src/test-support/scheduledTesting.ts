import { Effect, Schema } from "effect";
import { defineQueue, defineSchedule } from "#definition.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";
import { makePgBossTesting } from "#testing.ts";

export function scheduledTesting(runtime: ReturnType<typeof pgBossRuntime>) {
	const testing = makePgBossTesting();
	const runs: string[] = [];
	const daily = defineSchedule({
		cron: "17 3 * * *",
		name: "daily-cleanup",
		schedule: { key: "daily", startAfter: 86_400 },
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const weekly = defineSchedule({ cron: "23 9 * * 1", name: "weekly-report", schedule: { tz: "Europe/Berlin" } });
	const queue = defineQueue({ name: daily.name, schema: Schema.Struct({ id: Schema.Number }) });
	return {
		daily,
		recordedRuns: () => [...runs],
		startProducer: () => runtime.boot([queue], { clientFactory: testing.clientFactory }),
		startWorker: () =>
			runtime.boot([daily.run(Effect.sync(() => runs.push(daily.name))), weekly.run(Effect.sync(() => runs.push(weekly.name)))], {
				clientFactory: testing.clientFactory,
				schedule: false,
			}),
		testing,
	};
}
