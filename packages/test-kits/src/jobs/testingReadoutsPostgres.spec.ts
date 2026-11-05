import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { defineSchedule } from "@shivaedev/jobs/server/defineSchedule.ts";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/jobs/postgres/database.ts";
import { controlled, enqueued, running } from "#test/jobs/postgres/traits.ts";
import { scheduled } from "#test/jobs/workers.ts";

const First = defineQueue({ name: "first", schema: Schema.Struct({}) });
const Second = defineQueue({ name: "second", schema: Schema.Struct({}) });
const Cleanup = defineSchedule({
	cron: "17 3 * * *",
	name: "cleanup",
	queue: { expireInSeconds: 60, retryLimit: 1 },
	schedule: { startAfter: 86_400 },
	worker: { pollingIntervalSeconds: 0.5 },
});
const CleanupReadout = { name: Cleanup.name, schema: Schema.Null };

for (const target of ["first", "all"] as const) {
	database.it(
		`the testing controller refreshes ${target} queue statistics before health reads the new counts`,
		[running("app", [First, Second], { supervise: false }), enqueued(First, {}, { as: "first job" }), enqueued(Second, {}, { as: "second job" })],
		function* ({ answered, ask, askTesting }) {
			yield* ask("app", "read health before refreshing", (jobs) => jobs.health());
			expect(yield* answered()).toMatchObject({
				jobs: [
					{ name: First.name, readyCount: 0 },
					{ name: Second.name, readyCount: 0 },
				],
			});

			yield* askTesting("app", "refresh queue statistics", (testing) => testing.refreshQueueStats(target === "all" ? undefined : First));

			yield* ask("app", "read refreshed health", (jobs) => jobs.health());
			expect(yield* answered()).toMatchObject({
				jobs: [
					{ name: First.name, readyCount: 1 },
					{ name: Second.name, readyCount: target === "all" ? 1 : 0 },
				],
			});
		},
	);
}

database.it(
	"a triggered schedule returns the identity of its completed run with a null payload readout",
	[running("app", [scheduled(Cleanup, "succeeds")], { controller: "test retries", schedule: false })],
	function* ({ answered, controllerJobs, triggerRun, untilJob }) {
		expect(yield* controllerJobs("app", CleanupReadout)).toEqual([]);

		yield* triggerRun("app", Cleanup, "cleanup run");
		yield* untilJob("cleanup run", "completed");

		yield* outcomes([
			["triggered run", () => answered(), "cleanup run"],
			["completed run", () => controllerJobs("app", CleanupReadout), [{ data: null, job: "cleanup run", state: "completed" }]],
		]);
	},
);

database.it(
	"a triggered run expires on its second claim without running the scheduled effect again",
	[
		running("app", [scheduled(Cleanup, { fails: "cleanup failed" })], { controller: "test retries", schedule: false }),
		controlled((testing) => testing.expireAfter(Cleanup, 2), "expire the second cleanup claim"),
	],
	function* ({ attempts, job, triggerRun, untilIdle }) {
		expect(yield* attempts(Cleanup)).toEqual([]);

		yield* triggerRun("app", Cleanup, "expired run");
		yield* untilIdle("app");

		yield* outcomes([
			["scheduled effects", () => attempts(Cleanup), ["run 1 of cleanup"]],
			["expired run", () => job("expired run"), { error: "Error: job timed out", retryCount: 1, state: "failed" }],
		]);
	},
);

database.it(
	"a triggered run uses the controller's one-second expiry and completes its retry after a stuck effect",
	[
		running("app", [scheduled(Cleanup, "hangs", "succeeds")], { controller: "test retries", schedule: false }),
		controlled((testing) => testing.expireIn(Cleanup, "1 second"), "expire cleanup attempts after one second"),
	],
	function* ({ job, triggerRun, timePasses, untilAttempts, untilIdle }) {
		yield* triggerRun("app", Cleanup, "retried run");
		yield* untilAttempts(Cleanup, 1);
		yield* timePasses("1 second");
		yield* timePasses("500 millis");
		yield* untilIdle("app");

		expect(yield* job("retried run")).toMatchObject({ expireInSeconds: 1, retryCount: 1, state: "completed" });
	},
);
