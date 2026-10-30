import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, reached, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const cases = [
	{ counts: { activeCount: 0, failedCount: 1, queuedCount: 0 }, retryLimit: 0, state: "failed" },
	{ counts: { activeCount: 0, failedCount: 0, queuedCount: 1 }, retryLimit: 1, state: "retry" },
] as const;

for (const { counts, retryLimit, state } of cases) {
	const queue = defineQueue({
		name: "control",
		queue: { retryBackoff: false, retryDelay: 3600, retryLimit },
		schema: Schema.Struct({ id: Schema.NumberFromString }),
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const given = [
		running("app", [worker(queue, { fails: "Try again" }, "succeeds")]),
		enqueued(queue, { id: 42 }, { as: "job 42" }),
		reached("job 42", state),
	];

	database.it(
		`retrying a ${state} job runs it again under its original id until it completes`,
		given,
		function* ({ attempts, job, retry, untilJob }) {
			expect(yield* job("job 42")).toMatchObject({ state });

			yield* retry("app", "job 42");
			yield* untilJob("job 42", "completed");

			yield* outcomes({
				"attempts": [attempts(queue), ["job 42", "job 42"]],
				"job 42": [job("job 42"), expect.objectContaining({ data: { id: 42 }, job: "job 42", state: "completed" })],
			});
		},
	);

	database.it(`counts report a ${state} job as ${state === "failed" ? "failed" : "queued"}`, given, function* ({ answered, ask }) {
		yield* ask("app", "count control jobs", (jobs) => jobs.counts(queue));

		expect(yield* answered()).toMatchObject(counts);
	});

	database.it(`enqueueing again under the id of a ${state} job returns nothing`, given, function* ({ answered, enqueue }) {
		yield* enqueue("app", queue, { id: 42 }, { as: "duplicate", sameIdAs: "job 42" });

		expect(yield* answered()).toBe("nothing");
	});
}
