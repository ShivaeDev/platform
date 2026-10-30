import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { deferred, enqueued, ranDeferredNow, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

for (const partition of [false, true]) {
	const Stately = defineQueue({
		name: "stately",
		queue: { partition, policy: "stately", retryLimit: 0 },
		schema: Schema.Struct({ value: Schema.Number }),
		worker: { batchSize: 1, localConcurrency: 2, pollingIntervalSeconds: 0.5 },
	});
	const storage = partition ? "a partitioned" : "an unpartitioned";
	const siblings = running("app", [worker(Stately, { defers: "Quota", until: "tomorrow" }, { waitsFor: "resumed" })], { reportsErrors: true });
	const bothDeferred = [
		siblings,
		enqueued(Stately, { value: 1 }, { as: "first sibling", singletonKey: "shared-account" }),
		deferred(Stately, 1),
		enqueued(Stately, { value: 2 }, { as: "second sibling", singletonKey: "shared-account" }),
		deferred(Stately, 2),
	];

	database.it(
		`stately siblings for one key on ${storage} queue both defer without spending a retry`,
		[siblings, enqueued(Stately, { value: 1 }, { as: "first sibling", singletonKey: "shared-account" }), deferred(Stately, 1)],
		function* ({ deadLettered, deferrals, enqueue, reported, storedJobs, untilDeferred }) {
			yield* enqueue("app", Stately, { value: 2 }, { as: "second sibling", singletonKey: "shared-account" });
			yield* untilDeferred("app", Stately, 2);

			yield* outcomes({
				"dead-lettered": [deadLettered(Stately), []],
				"deferrals": [
					deferrals("app", Stately),
					[
						{ at: "the time the worker asked for", reason: "Quota" },
						{ at: "the time the worker asked for", reason: "Quota" },
					],
				],
				"reported errors": [reported(), []],
				"stored jobs": [
					storedJobs("stately"),
					expect.arrayContaining(
						["first sibling", "second sibling"].map((job) =>
							expect.objectContaining({ job, retryCount: 0, singletonKey: "shared-account", state: "retry" }),
						),
					),
				],
			});
		},
	);

	database.it(
		`running deferred stately siblings now on ${storage} queue resumes one at a time`,
		bothDeferred,
		function* ({ runDeferredNow, storedStateCounts, untilWaiting }) {
			expect(yield* storedStateCounts("stately")).toEqual({ retry: 2 });

			yield* runDeferredNow("app", Stately);
			yield* untilWaiting("resumed");

			expect(yield* storedStateCounts("stately")).toEqual({ active: 1, retry: 1 });
		},
	);

	database.it(
		`resumed stately siblings on ${storage} queue both complete under their own ids without spending a retry`,
		[...bothDeferred, ranDeferredNow(Stately), waiting("resumed", "one sibling has resumed")],
		function* ({ attemptCounts, deadLettered, open, reported, storedJobs, storedStateCounts, untilSettled }) {
			expect(yield* storedStateCounts("stately")).toEqual({ active: 1, retry: 1 });

			yield* open("resumed");
			yield* untilSettled(Stately, 2);

			yield* outcomes({
				"attempts": [attemptCounts(Stately), { "first sibling": 2, "second sibling": 2 }],
				"dead-lettered": [deadLettered(Stately), []],
				"reported errors": [reported(), []],
				"stored jobs": [
					storedJobs("stately"),
					expect.arrayContaining(
						["first sibling", "second sibling"].map((job) => expect.objectContaining({ job, retryCount: 0, state: "completed" })),
					),
				],
			});
		},
	);
}
