import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { scheduled } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

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
		triggered: { answer: "done", runs: ["run 1 of daily-cleanup"] },
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
		`triggering the daily schedule in a runtime that ${runtime} answers ${triggered.answer === "done" ? "by running it once" : "with a typed testing error"}`,
		[],
		function* ({ answered, askTesting, attempts, start, untilIdle }) {
			yield* start("app", jobs, { controller: "test retries", schedule: false });
			expect(yield* attempts(Daily)).toEqual([]);

			yield* askTesting("app", "trigger the daily schedule", (testing) => testing.trigger(Daily));
			yield* untilIdle("app");

			expect({ answer: yield* answered(), runs: yield* attempts(Daily) }).toEqual(triggered);
		},
	);
}
