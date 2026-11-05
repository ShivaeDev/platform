import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/jobs/postgres/database.ts";
import { running, storedTogether, waiting } from "#test/jobs/postgres/traits.ts";
import { workerBy } from "#test/jobs/workers.ts";

const Revised = defineQueue({ name: "revised", schema: Schema.Struct({ id: Schema.Number }), worker: { batchSize: 2, pollingIntervalSeconds: 0.5 } });

for (const changeNotificationsWaitFor of [undefined, "notifications"]) {
	const batchOfTwo = [
		storedTogether(
			Revised,
			[0, 1].map((id) => ({ as: `job ${id}`, data: { id }, priority: 10 - id })),
		),
		running(
			"app",
			[
				workerBy(Revised, ({ id }) =>
					id === 0 ? { afterwards: { defers: "Quota", until: "tomorrow" }, waitsFor: "first" } : { waitsFor: "second" },
				),
			],
			{
				...(changeNotificationsWaitFor === undefined ? {} : { changeNotificationsWaitFor }),
				handsBatchesOver: "by priority",
			},
		),
		waiting("first", "job 0 runs at the head of its batch"),
	];

	database.it(
		`a deferral signals the testing controller while the rest of its batch still runs${changeNotificationsWaitFor === undefined ? "" : " before PostgreSQL notifications arrive"}`,
		batchOfTwo,
		function* ({ deferrals, markRevision, open, revisionSinceMark, storedStates, untilWaiting }) {
			expect(yield* storedStates("revised")).toEqual({ "job 0": "active", "job 1": "active" });

			yield* markRevision("app");
			expect(yield* revisionSinceMark("app")).toBe("unchanged since the mark");

			yield* open("first");
			yield* untilWaiting("second");

			yield* outcomes([
				["revision", () => revisionSinceMark("app"), "changed since the mark"],
				["deferrals", () => deferrals("app", Revised), [{ at: "the time the worker asked for", reason: "Quota" }]],
				["stored states", () => storedStates("revised"), { "job 0": "retry", "job 1": "active" }],
			]);
		},
	);
}
