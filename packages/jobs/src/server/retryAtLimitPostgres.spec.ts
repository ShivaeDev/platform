import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { deferred, enqueued, running, stoppedAfterwards } from "#test/postgres/traits.ts";
import { type Attempt, scheduled, worker } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const DEFAULT_LIMIT = 10;
const Limited = defineQueue({
	name: "limited",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
});
const deferNow: Attempt = { defers: "Still limited", until: "now" };

database.it(
	"a job defers ten times by default before a further deferral spends an ordinary retry",
	[running("app", [worker(Limited, ...Array.from({ length: DEFAULT_LIMIT + 1 }, () => deferNow), "succeeds")])],
	function* ({ attemptCounts, enqueue, job, untilJob }) {
		yield* enqueue("app", Limited, {}, { as: "job" });
		yield* untilJob("job", "completed");

		yield* outcomes({
			"attempts": [attemptCounts(Limited), { job: DEFAULT_LIMIT + 2 }],
			"job": [job("job"), expect.objectContaining({ retryCount: 1 })],
		});
	},
);

const Restarted = defineQueue({
	name: "restarted",
	queue: { maxDeferrals: 1, retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: { pollingIntervalSeconds: 0.5 },
});
const deferringAgain = worker(Restarted, { defers: "Quota", until: "tomorrow" }, deferNow, "succeeds");

database.it(
	"the deferral limit holds across a restart, so the next deferral spends an ordinary retry",
	[
		running("first", [deferringAgain]),
		enqueued(Restarted, {}, { as: "job", by: "first" }),
		deferred(Restarted, 1, "first"),
		stoppedAfterwards("first"),
	],
	function* ({ attempts, job, runDeferredNow, start, untilJob }) {
		yield* start("second", [deferringAgain]);
		yield* runDeferredNow("second", Restarted);
		yield* untilJob("job", "completed");

		yield* outcomes({
			"attempts": [attempts(Restarted), ["job", "job", "job"]],
			"job": [job("job"), expect.objectContaining({ retryCount: 1 })],
		});
	},
);

const Monthly = defineSchedule({
	cron: "0 0 1 1 *",
	name: "monthly",
	queue: { maxDeferrals: 1, retryLimit: 0 },
	worker: { pollingIntervalSeconds: 0.5 },
});
const Undeferrable = defineSchedule({
	cron: "0 0 1 1 *",
	name: "undeferrable",
	queue: { maxDeferrals: 0, retryLimit: 0 },
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"a scheduled run defers without spending a retry and keeps its data and singleton key",
	[running("app", [scheduled(Monthly, { defers: "Scheduled quota", until: "tomorrow" })])],
	function* ({ adminSends, storedJobs, untilDeferred }) {
		yield* adminSends("monthly", { retained: true }, { as: "monthly run", singletonKey: "schedule-key" });
		yield* untilDeferred("app", Monthly, 1);

		expect(yield* storedJobs("monthly")).toEqual([
			expect.objectContaining({ data: { retained: true }, job: "monthly run", retryCount: 0, singletonKey: "schedule-key", state: "retry" }),
		]);
	},
);

database.it(
	"a scheduled run with a deferral limit of zero fails its deferral like any other failure",
	[running("app", [scheduled(Undeferrable, { defers: "Disabled", until: "tomorrow" })])],
	function* ({ adminSends, storedJobs, untilSettled }) {
		yield* adminSends("undeferrable", null, { as: "undeferrable run" });
		yield* untilSettled(Undeferrable, 1);

		expect(yield* storedJobs("undeferrable")).toEqual([
			expect.objectContaining({ error: "RetryAt", job: "undeferrable run", retryCount: 0, state: "failed" }),
		]);
	},
);
