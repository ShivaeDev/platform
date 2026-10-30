import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running, storedTogether, waiting } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const Revised = defineQueue({ name: "revised", schema: Schema.Struct({ id: Schema.Number }), worker: { batchSize: 2, pollingIntervalSeconds: 0.5 } });

const batchOfTwo = [
	storedTogether(
		Revised,
		[0, 1].map((id) => ({ as: `job ${id}`, data: { id }, priority: 10 - id })),
	),
	running(
		"app",
		[workerBy(Revised, ({ id }) => (id === 0 ? { afterwards: { defers: "Quota", until: "tomorrow" }, waitsFor: "first" } : { waitsFor: "second" }))],
		{
			handsBatchesOver: "by priority",
		},
	),
	waiting("first", "job 0 runs at the head of its batch"),
];

database.it(
	"a deferral signals the testing controller while the rest of its batch still runs",
	batchOfTwo,
	function* ({ deferrals, markRevision, open, revisionSinceMark, storedStates, untilWaiting }) {
		expect(yield* storedStates("revised")).toEqual({ "job 0": "active", "job 1": "active" });

		yield* markRevision("app");
		yield* open("first");
		yield* untilWaiting("second");

		yield* outcomes({
			"deferrals": [deferrals("app", Revised), [{ at: "the time the worker asked for", reason: "Quota" }]],
			"revision": [revisionSinceMark("app"), "changed since the mark"],
			"stored states": [storedStates("revised"), { "job 0": "retry", "job 1": "active" }],
		});
	},
);
