import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { claimedElsewhere, enqueued, enqueuedUntil, running } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const Reports = defineQueue({
	name: "reports",
	queue: { retryLimit: 0 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});
const FollowUps = defineQueue({ name: "follow-ups", schema: Schema.Struct({ note: Schema.String }) });

const mixed = [
	running("app", [workerBy(Reports, ({ id }) => (id === 1 ? { fails: "The report cannot be built" } : "succeeds")), FollowUps], {
		controller: "test retries",
	}),
	enqueuedUntil(Reports, { id: 1 }, { as: "failed report" }, "failed"),
	enqueuedUntil(Reports, { id: 2 }, { as: "completed report" }, "completed"),
	enqueued(FollowUps, { note: "claimed" }, { as: "claimed follow-up" }),
	claimedElsewhere("claimed follow-up"),
	enqueued(FollowUps, { note: "later" }, { as: "later follow-up", startAfter: 3600 }),
];

database.it(
	"a snapshot of two queues reads their unfinished jobs in send order and leaves completed jobs out",
	mixed,
	function* ({ enqueue, snapshot, untilIdle }) {
		expect(yield* snapshot("app", [Reports, FollowUps])).not.toContainEqual(expect.objectContaining({ job: "later report" }));

		yield* enqueue("app", Reports, { id: 3 }, { as: "later report", startAfter: 3600 });
		yield* untilIdle("app");

		expect(yield* snapshot("app", [Reports, FollowUps])).toEqual([
			{ data: { id: 1 }, job: "failed report", queue: "reports", starts: "by now", state: "failed" },
			{ data: { note: "claimed" }, job: "claimed follow-up", queue: "follow-ups", starts: "by now", state: "active" },
			{ data: { note: "later" }, job: "later follow-up", queue: "follow-ups", starts: "later", state: "created" },
			{ data: { id: 3 }, job: "later report", queue: "reports", starts: "later", state: "created" },
		]);
	},
);

const readings = [
	{
		answer: [expect.objectContaining({ data: { id: "1" } })],
		outcome: "decodes the job through the schema it is given",
		schema: Schema.Struct({ id: Schema.Literals(["1", "3"]) }),
	},
	{
		answer: expect.stringMatching(/^decode reports payload failed with /u),
		outcome: "rejects data the schema it is given cannot decode",
		schema: Schema.Struct({ id: Schema.Literal("3") }),
	},
];

for (const { answer, outcome, schema } of readings) {
	database.it(
		`a snapshot ${outcome}`,
		[running("app", [Reports], { controller: "test retries" }), enqueued(Reports, { id: 1 }, { as: "report", startAfter: 3600 })],
		function* ({ snapshot }) {
			expect(yield* snapshot("app", [Reports])).toMatchObject([{ data: { id: 1 } }]);

			const reading = defineQueue({ name: Reports.name, schema });

			expect(yield* snapshot("app", [reading])).toEqual(answer);
		},
	);
}
