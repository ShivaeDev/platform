import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { handedOver, releaseHeld } from "#test/postgres/releaseTraits.ts";
import { enqueued, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Payload = Schema.Struct({ id: Schema.Number });
const First = defineQueue({ name: "release-first", schema: Payload, worker: { pollingIntervalSeconds: 0.5 } });
const Second = defineQueue({ name: "release-second", schema: Payload, worker: { pollingIntervalSeconds: 0.5 } });
const Third = defineQueue({ name: "another-layer", schema: Payload, worker: { pollingIntervalSeconds: 0.5 } });

const thisDeployment = releaseHeld("this deployment");
const sibling = running("sibling", [worker(Third, "succeeds")]);

database.it(
	"handing the database release to another deployment waits for the running job, then pauses every queue",
	[
		thisDeployment,
		running("app", [worker(First, { waitsFor: "first" }), worker(Second, "succeeds")]),
		sibling,
		enqueued(First, { id: 1 }, { as: "job 1" }),
		waiting("first", "job 1 is running"),
	],
	function* ({ handOverRelease, job, open, timeline, untilHandedOver, workingQueues }) {
		expect(yield* workingQueues("app")).toEqual(["release-first", "release-second"]);

		yield* handOverRelease();
		yield* open("first");
		yield* untilHandedOver();

		yield* outcomes({
			"app queues working": [workingQueues("app"), []],
			"app timeline": [timeline("app"), ["job 1 finished", "app: Workers paused for another database release"]],
			"job 1": [job("job 1"), expect.objectContaining({ state: "completed" })],
			"sibling queues working": [workingQueues("sibling"), []],
			"sibling timeline": [timeline("sibling"), ["sibling: Workers paused for another database release"]],
		});
	},
);

database.it(
	"jobs enqueued while another deployment holds the release run once it returns",
	[
		thisDeployment,
		running("app", [worker(First, "succeeds"), worker(Second, "succeeds")]),
		sibling,
		handedOver,
		enqueued(First, { id: 2 }, { as: "job 2" }),
		enqueued(Second, { id: 3 }, { as: "job 3" }),
		enqueued(Third, { id: 4 }, { as: "job 4", by: "sibling" }),
	],
	function* ({ takeBackRelease, timeline, untilJob, workingQueues }) {
		expect(yield* workingQueues("app")).toEqual([]);

		yield* takeBackRelease();
		for (const as of ["job 2", "job 3", "job 4"]) {
			yield* untilJob(as, "completed");
		}

		yield* outcomes({
			"app timeline": [
				timeline("app"),
				expect.arrayContaining([
					"app: Workers paused for another database release",
					"app: Workers resumed for database release",
					"job 2 finished",
					"job 3 finished",
				]),
			],
			"sibling timeline": [
				timeline("sibling"),
				["sibling: Workers paused for another database release", "sibling: Workers resumed for database release", "job 4 finished"],
			],
		});
	},
);

database.it(
	"a runtime started while another deployment holds the release accepts jobs and runs them once the release returns",
	[releaseHeld("another deployment"), running("app", [worker(First, "succeeds")]), enqueued(First, { id: 42 }, { as: "job 42" })],
	function* ({ attempts, takeBackRelease, untilJob, workingQueues }) {
		expect(yield* workingQueues("app")).toEqual([]);

		yield* takeBackRelease();
		yield* untilJob("job 42", "completed");

		expect(yield* attempts(First)).toEqual(["job 42"]);
	},
);
