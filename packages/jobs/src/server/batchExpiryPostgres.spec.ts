import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue, defineSchedule } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { interrupted, running, storedTogether } from "#test/postgres/traits.ts";
import { scheduled, workerBy } from "#test/workers.ts";

const Expiring = defineQueue({
	name: "batch-expiry",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { batchSize: 4, pollingIntervalSeconds: 0.5 },
});

const batch = storedTogether(
	Expiring,
	[0, 1, 2, 3].map((id) => ({ as: `job ${id}`, data: { id }, expireInSeconds: id === 0 || id === 3 ? 4 : 1, priority: 10 - id })),
);
const hangingOnce = workerBy(Expiring, ({ id }, attempt) => (id === 1 && attempt === 0 ? "hangs" : "succeeds"));
const byPriority = { handsBatchesOver: "by priority" } as const;

database.it(
	"a job that outlives its deadline is interrupted at it, and the rest of its batch is left for expiry",
	[batch],
	function* ({ attempts, interruptions, start, storedStates, untilInterrupted }) {
		expect(Object.values(yield* storedStates("batch-expiry"))).toEqual(["created", "created", "created", "created"]);

		yield* start("app", [hangingOnce], byPriority);
		yield* untilInterrupted(Expiring, 1);

		yield* outcomes({
			"attempts": [attempts(Expiring), ["job 0", "job 1"]],
			"interruptions": [interruptions(Expiring), ["job 1 at or after its deadline"]],
			"stored states": [storedStates("batch-expiry"), { "job 0": "completed", "job 1": "active", "job 2": "active", "job 3": "active" }],
		});
	},
);

database.it(
	"the jobs a batch left behind run again once they expire, never alongside their first attempt",
	[batch, running("app", [hangingOnce], byPriority), interrupted(Expiring, 1)],
	function* ({ attemptCounts, overlappingAttempts, storedStates, untilSettled }) {
		expect(yield* attemptCounts(Expiring)).toEqual({ "job 0": 1, "job 1": 1 });

		yield* untilSettled(Expiring, 4);

		yield* outcomes({
			"attempts": [attemptCounts(Expiring), { "job 0": 1, "job 1": 2, "job 2": 1, "job 3": 1 }],
			"overlapping attempts": [overlappingAttempts(), []],
			"stored states": [storedStates("batch-expiry"), { "job 0": "completed", "job 1": "completed", "job 2": "completed", "job 3": "completed" }],
		});
	},
);

const Hourly = defineSchedule({ cron: "0 * * * *", name: "hourly", queue: { expireInSeconds: 1, retryLimit: 0 } });

database.it(
	"a scheduled run that outlives its expiry is interrupted, failed by pg-boss and listed with pg-boss's timeout as an Error",
	[running("app", [scheduled(Hourly, "hangs")])],
	function* ({ adminSends, interruptions, listedOutputs, storedJobs, untilSettled }) {
		yield* adminSends("hourly", null, { as: "hourly run" });
		yield* untilSettled(Hourly, 1);

		yield* outcomes({
			"failed listing": [
				listedOutputs("app", "failed", { name: Hourly.name, schema: Schema.Null }),
				[{ _tag: "Error", message: "handler execution exceeded 1s" }],
			],
			"interruptions": [interruptions(Hourly), ["run 1 of hourly at or after its deadline"]],
			"stored runs": [
				storedJobs("hourly"),
				[expect.objectContaining({ error: "handler execution exceeded 1s", job: "hourly run", state: "failed" })],
			],
		});
	},
);
