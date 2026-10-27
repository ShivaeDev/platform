import { Effect } from "effect";
import { expect } from "vitest";
import { postgresIt, realPostgres } from "#test/boss.ts";

postgresIt("lists each registered schedule's name, cron and timezone", [realPostgres], function* ({ schedules }) {
	yield* schedules.startWorker();
	expect(yield* schedules.testing.schedules()).toEqual([
		{ cron: "17 3 * * *", name: "daily-cleanup", timezone: "UTC" },
		{ cron: "23 9 * * 1", name: "weekly-report", timezone: "Europe/Berlin" },
	]);
});

postgresIt("runs a registered schedule's Effect once when triggered through the testing kit", [realPostgres], function* ({ schedules }) {
	yield* schedules.startWorker();
	yield* schedules.testing.trigger(schedules.daily);
	yield* schedules.testing.waitForIdle;
	expect(schedules.recordedRuns()).toEqual(["daily-cleanup"]);
});

postgresIt("registers no schedules in a request runtime that only declares queues", [realPostgres], function* ({ schedules }) {
	yield* schedules.startProducer();
	expect(yield* schedules.testing.schedules()).toEqual([]);
});

postgresIt("requires a registered schedule even when its queue exists", [realPostgres], function* ({ schedules }) {
	yield* schedules.startProducer();
	expect(yield* schedules.testing.trigger(schedules.daily).pipe(Effect.flip)).toMatchObject({
		_tag: "PgBossTestingError",
		operation: "trigger",
		queue: "daily-cleanup",
	});
});
