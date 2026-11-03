import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, idleWaitStarted, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Reports = defineQueue({
	name: "reports",
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});
const Emails = defineQueue({ name: "emails", schema: Reports.schema, worker: Reports.workerOptions });

database.it(
	"a producer's idle wait discovers every registered queue and waits for their workers to start and finish",
	[
		running("producer", [Reports, Emails]),
		enqueued(Reports, { id: 1 }, { as: "report", by: "producer" }),
		enqueued(Emails, { id: 2 }, { as: "email", by: "producer" }),
		idleWaitStarted("producer"),
	],
	function* ({ handled, idleWait, start, untilIdleWaitSettles }) {
		expect(yield* idleWait("producer")).toBe("still waiting");

		yield* start("worker", [worker(Reports, "succeeds"), worker(Emails, "succeeds")], { controller: "none" });
		yield* untilIdleWaitSettles("producer");

		yield* outcomes([
			["reports handled", () => handled(Reports), [{ id: 1 }]],
			["emails handled", () => handled(Emails), [{ id: 2 }]],
		]);
	},
);

for (const { schema, wrapped, offset } of [
	{ offset: 0, schema: "pgboss", wrapped: false },
	{ offset: 0, schema: "custom_jobs", wrapped: false },
	{ offset: 1000, schema: "pgboss", wrapped: false },
	{ offset: 0, schema: "pgboss", wrapped: true },
] as const) {
	database.it(
		`in ${schema} with the clock advanced by ${offset}ms, a producer${wrapped ? " with a wrapped client" : ""} waits for an active job in a separate worker client without a testing controller`,
		[
			running("producer", [Reports], { schema, ...(wrapped ? { wrapsClient: true } : {}) }),
			running("worker", [worker(Reports, { waitsFor: "report" })], { controller: "none", schema }),
			enqueued(Reports, { id: 42 }, { as: "report", by: "producer" }),
			waiting("report"),
			idleWaitStarted("producer"),
		],
		function* ({ idleWait, open, snapshot, timePasses, untilIdleWaitSettles }) {
			expect(yield* idleWait("producer")).toBe("still waiting");

			yield* timePasses(offset);
			yield* open("report");
			yield* untilIdleWaitSettles("producer");

			expect(yield* snapshot("producer", [Reports])).toEqual([]);
		},
	);
}

database.it(
	"an idle wait ignores future jobs in its registered queues and ready jobs in unregistered queues",
	[
		running("producer", [Reports]),
		running("other producer", [Emails]),
		enqueued(Reports, { id: 1 }, { as: "later report", by: "producer", startAfter: 3600 }),
		enqueued(Emails, { id: 2 }, { as: "ready email", by: "other producer" }),
	],
	function* ({ snapshot, untilIdle }) {
		yield* untilIdle("producer");

		expect(yield* snapshot("producer", [Reports, Emails])).toEqual([
			{ data: { id: 1 }, job: "later report", queue: "reports", starts: "later", state: "created" },
			{ data: { id: 2 }, job: "ready email", queue: "emails", starts: "by now", state: "created" },
		]);
	},
);
