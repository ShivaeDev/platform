import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { defineSchedule } from "@shivaedev/jobs/server/defineSchedule.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { database } from "#test/jobs/postgres/database.ts";
import { scheduled } from "#test/jobs/workers.ts";

const Daily = defineSchedule({
	cron: "17 3 * * *",
	name: "daily-cleanup",
	schedule: { key: "daily", startAfter: 86_400 },
	worker: { pollingIntervalSeconds: 0.5 },
});
const Weekly = defineSchedule({ cron: "23 9 * * 1", name: "weekly-report", schedule: { tz: "Europe/Berlin" } });
const DailyQueue = defineQueue({ name: Daily.name, schema: Schema.Struct({ id: Schema.Number }) });

const runtimes = [
	{
		jobs: [scheduled(Daily, "succeeds"), scheduled(Weekly, "succeeds")],
		listed: [
			{ cron: "17 3 * * *", name: "daily-cleanup", timezone: "UTC" },
			{ cron: "23 9 * * 1", name: "weekly-report", timezone: "Europe/Berlin" },
		],
		runtime: "runs the schedules",
		triggered: { answer: "daily run", runs: ["run 1 of daily-cleanup"] },
	},
	{
		jobs: [DailyQueue],
		listed: [],
		runtime: "only declares the schedule's queue",
		triggered: { answer: "testing trigger daily-cleanup failed with Schedule is not registered", runs: [] },
	},
];

for (const { jobs, listed, runtime } of runtimes) {
	database.it(
		`the testing controller of a runtime that ${runtime} lists ${listed.length} schedules`,
		[],
		function* ({ answered, askTesting, start }) {
			expect(yield* answered()).toBe("nothing asked yet");

			yield* start("app", jobs, { controller: "test retries", schedule: false });
			yield* askTesting("app", "list the registered schedules", (testing) => testing.schedules());

			expect(yield* answered()).toEqual(listed);
		},
	);
}

for (const { jobs, runtime, triggered } of runtimes) {
	database.it(
		`triggering the daily schedule in a runtime that ${runtime} answers ${triggered.answer === "daily run" ? "by naming its run and running it once" : "with a typed testing error"}`,
		[],
		function* ({ answered, attempts, start, triggerRun, untilIdle }) {
			yield* start("app", jobs, { controller: "test retries", schedule: false });
			expect(yield* attempts(Daily)).toEqual([]);

			yield* triggerRun("app", Daily, "daily run");
			yield* untilIdle("app");

			expect({ answer: yield* answered(), runs: yield* attempts(Daily) }).toEqual(triggered);
		},
	);
}
