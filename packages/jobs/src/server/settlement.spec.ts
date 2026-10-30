import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { claimReadsStall, deferralWritesFail, running, runtime, settlementlessClient, storedJob } from "#test/runtime/kit.ts";
import { storedJob as stored } from "#test/runtime/storedJob.ts";
import { scheduled, worker, workerBy } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Hourly = defineSchedule({ cron: "0 * * * *", name: "hourly" });
const tenRuns = Array.from({ length: 10 }, (_, index) => ({ data: null, id: `run-${index}` }));

for (const outcome of [{ fails: "scheduled poison job" }, { dies: "scheduled poison job" }] as const) {
	runtime.it(
		`when the second of ten scheduled runs ${"fails" in outcome ? "fails" : "dies"}, only that run fails and the other nine complete`,
		[running("app", [scheduled(Hourly, "succeeds", outcome, "succeeds")])],
		function* ({ deliver, settlements }) {
			yield* deliver("hourly", tenRuns);

			expect(yield* settlements()).toEqual(
				tenRuns.map(({ id }) => (id === "run-1" ? `${id} failed with Error: scheduled poison job` : `${id} completed`)),
			);
		},
	);
}

const Reports = defineQueue({ name: "reports", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });

runtime.it(
	"a job's remaining budget counts from when pg-boss claimed it, not from when its handler starts",
	[running("app", [worker(Reports, "succeeds")])],
	function* ({ deliver, startedAttempts }) {
		yield* deliver("reports", [{ data: { id: 1 }, expireInSeconds: 1, id: "job-1", startedMillisAgo: 600 }]);

		expect(yield* startedAttempts()).toEqual([{ budget: expect.closeTo(400, -2), id: "job-1" }]);
	},
);

runtime.it(
	"a job whose expiry passed before its batch reached it is neither run nor settled",
	[storedJob(stored("reports", "job-0", { id: 0 }, "failed")), running("app", [worker(Reports, "succeeds")])],
	function* ({ deliver, handled, settlements }) {
		yield* deliver("reports", [{ data: { id: 0 }, expireInSeconds: 1, id: "job-0", startedMillisAgo: 1500 }]);

		yield* outcomes({
			"handled payloads": [handled("reports"), []],
			"settlements": [settlements(), []],
		});
	},
);

runtime.it(
	"a later job with budget left still runs and completes after an expired job before it was skipped",
	[storedJob(stored("reports", "job-0", { id: 0 }, "failed")), running("app", [worker(Reports, "succeeds")])],
	function* ({ deliver, handled, settlements }) {
		yield* deliver("reports", [
			{ data: { id: 0 }, expireInSeconds: 1, id: "job-0", startedMillisAgo: 1500 },
			{ data: { id: 1 }, expireInSeconds: 3, id: "job-1", startedMillisAgo: 1500 },
		]);

		yield* outcomes({
			"handled payloads": [handled("reports"), [{ id: 1 }]],
			"settlements": [settlements(), ["job-1 completed"]],
		});
	},
);

const threeJobs = [0, 1, 2].map((id) => ({ data: { id }, expireInSeconds: 60, id: `job-${id}` }));
const expiredByPgBoss = threeJobs.map(({ data, id }) => storedJob(stored("reports", id, data, "failed")));

runtime.it(
	"after the second job of a batch interrupts itself, the batch leaves it and the third job unsettled for pg-boss expiry",
	[...expiredByPgBoss, running("app", [workerBy(Reports, ({ id }) => (id === 1 ? "interrupts itself" : "succeeds"))])],
	function* ({ deliver, handled, settlements }) {
		yield* deliver("reports", threeJobs);

		yield* outcomes({
			"handled payloads": [handled("reports"), [{ id: 0 }, { id: 1 }]],
			"settlements": [settlements(), ["job-0 completed"]],
		});
	},
);

runtime.it(
	"after pg-boss aborts the second job of a batch, the batch interrupts it and leaves it and the third job unsettled",
	[...expiredByPgBoss, running("app", [workerBy(Reports, ({ id }) => (id === 1 ? "hangs" : "succeeds"))])],
	function* ({ deliver, handled, interrupted, settlements }) {
		yield* deliver("reports", threeJobs, { pgBossAborts: "job-1" });

		yield* outcomes({
			"handled payloads": [handled("reports"), [{ id: 0 }, { id: 1 }]],
			"interrupted": [interrupted(), ["job-1"]],
			"settlements": [settlements(), ["job-0 completed"]],
		});
	},
);

for (const reads of [
	{ given: [storedJob(stored("reports", "job-1", { id: 1 }, "active"))], how: "keep reporting the claim active" },
	{ given: [claimReadsStall], how: "never answer" },
]) {
	runtime.it(
		`when claim reads ${reads.how} after an interruption, the batch gives up a second past its deadline with a logged settle error`,
		[...reads.given, running("app", [worker(Reports, "hangs")])],
		function* ({ batchAnswer, deliver, deliveryReturned, logged }) {
			yield* deliver("reports", [{ data: { id: 1 }, expireInSeconds: 1, id: "job-1", startedMillisAgo: 900 }]);

			yield* outcomes({
				"batch": [batchAnswer(), expect.stringMatching(/^rejected with settle reports failed with Operation timed out/u)],
				"batch returned": [deliveryReturned(), "1 second after the batch deadline"],
				"logs": [logged(), [{ level: "Error", message: expect.stringMatching(/^settle reports failed with Operation timed out/u) }]],
			});
		},
	);
}

runtime.it(
	"while an interrupted claim stays active, the batch reads it back off to at most ten reads before giving up",
	[storedJob(stored("reports", "job-1", { id: 1 }, "active")), running("app", [worker(Reports, "hangs")])],
	function* ({ claimReads, deliver }) {
		yield* deliver("reports", [{ data: { id: 1 }, expireInSeconds: 1, id: "job-1", startedMillisAgo: 900 }]);

		expect(yield* claimReads()).toBeLessThanOrEqual(10);
	},
);

runtime.it("a client that cannot complete or fail jobs still runs a producer-only runtime", [settlementlessClient], function* ({ start, startup }) {
	yield* start("app", [Reports]);

	expect(yield* startup("app")).toBe("started");
});

runtime.it("a worker on a client that cannot complete or fail jobs fails registration", [settlementlessClient], function* ({ start, startup }) {
	yield* start("app", [worker(Reports, "succeeds")]);

	expect(yield* startup("app")).toBe("register reports failed with This pg-boss client does not support complete and fail");
});

const Deferring = defineQueue({ name: "deferral-outage", schema: Schema.Struct({}) });

runtime.it(
	"a deferral the deferral store cannot write fails its job with a typed settle error",
	[deferralWritesFail, running("app", [worker(Deferring, { defers: "Provider quota" })])],
	function* ({ deliver, settlements }) {
		yield* deliver("deferral-outage", [{ data: {}, id: "job-1" }]);

		expect(yield* settlements()).toEqual([
			expect.stringMatching(/^job-1 failed with PgBossError: pg-boss settle for queue deferral-outage failed:/u),
		]);
	},
);
