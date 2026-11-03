import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { deferred, enqueued, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Reports = defineQueue({
	name: "reports",
	queue: { expireInSeconds: 45, retentionSeconds: 7200 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});
const Emails = defineQueue({ name: "emails", schema: Reports.schema });

for (const schema of ["pgboss", "custom_jobs"]) {
	database.it(
		`inspection in ${schema} reads the requested queue's decoded stored jobs, state and expiry`,
		[running("producer", [Reports, Emails], { controller: "none", schema }), enqueued(Emails, { id: 9 }, { as: "email", by: "producer" })],
		function* ({ enqueue, inspectJobs }) {
			expect(yield* inspectJobs("producer", Reports)).toEqual([]);

			yield* enqueue("producer", Reports, { id: 42 }, { as: "report", startAfter: 3600 });

			expect(yield* inspectJobs("producer", Reports)).toEqual([
				{ data: { id: 42 }, expireInSeconds: 45, job: "report", retentionSeconds: 7200, state: "created" },
			]);
		},
	);

	database.it(
		`inspection in ${schema} signals a deferral committed by another client and reads its reason and requested time`,
		[
			running("producer", [Reports], { controller: "none", schema }),
			running("worker", [worker(Reports, { afterwards: { defers: "Quota", until: "tomorrow" }, waitsFor: "quota" })], { schema }),
			enqueued(Reports, { id: 42 }, { as: "report", by: "producer" }),
			waiting("quota"),
		],
		function* ({ inspectDeferrals, inspectionChanged, open, untilInspectionChanges, watchInspection }) {
			yield* watchInspection("producer", Reports);
			expect(yield* inspectionChanged("producer")).toBe(false);

			yield* open("quota");
			yield* untilInspectionChanges("producer");

			yield* outcomes([
				["signal", () => inspectionChanged("producer"), true],
				["deferral", () => inspectDeferrals("producer", Reports), [{ at: "the requested time", reason: "Quota" }]],
			]);
		},
	);
}

database.it(
	"inspection reads a deferral's reason and requested time alongside its retry payload, state and expiry",
	[
		running("producer", [Reports], { controller: "none" }),
		running("worker", [worker(Reports, { defers: "Quota", until: "tomorrow" })]),
		enqueued(Reports, { id: 42 }, { as: "report", by: "producer" }),
		deferred(Reports, 1, "worker"),
	],
	function* ({ inspectDeferrals, inspectJobs }) {
		yield* outcomes([
			["deferral", () => inspectDeferrals("producer", Reports), [{ at: "the requested time", reason: "Quota" }]],
			[
				"stored retry",
				() => inspectJobs("producer", Reports),
				[expect.objectContaining({ data: { id: 42 }, expireInSeconds: 45, job: "report", state: "retry" })],
			],
		]);
	},
);

database.it(
	"a queue inspection signal ignores another queue's committed change",
	[running("reports observer", [Reports], { controller: "none" }), running("all observer", [Emails], { controller: "none" })],
	function* ({ enqueue, inspectionChanged, untilInspectionChanges, watchInspection }) {
		yield* watchInspection("reports observer", Reports);
		yield* watchInspection("all observer");

		yield* enqueue("all observer", Emails, { id: 7 }, { as: "email" });
		yield* untilInspectionChanges("all observer");

		expect(yield* inspectionChanged("reports observer")).toBe(false);
	},
);
