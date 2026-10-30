import { Schema } from "effect";
import type { WorkOptions } from "pg-boss";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { storedTogether } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const POLLING_INTERVAL_SECONDS = 10;
const ids = Array.from({ length: 30 }, (_, id) => id);

const settings: readonly { readonly concurrency: number; readonly name: string; readonly options: WorkOptions }[] = [
	{ concurrency: 1, name: "default worker settings", options: {} },
	{ concurrency: 5, name: "batches of two and a local concurrency of five", options: { batchSize: 2, localConcurrency: 5 } },
];

for (const { concurrency, name, options } of settings) {
	const Backlog = defineQueue({
		name: "backlog",
		queue: { notify: true },
		schema: Schema.Struct({ id: Schema.Number }),
		worker: { pollingIntervalSeconds: POLLING_INTERVAL_SECONDS, ...options },
	});
	const backlog = storedTogether(
		Backlog,
		ids.map((id) => ({ as: `job ${id}`, data: { id } })),
	);

	database.it(
		`a worker with ${name} drains a backlog of thirty jobs before its next poll`,
		[backlog],
		function* ({ attemptCounts, drained, mostRunningAtOnce, start, untilFinished }) {
			expect(yield* attemptCounts(Backlog)).toEqual({});

			yield* start("app", [worker(Backlog, { waitsUntilRunning: concurrency })], { useListenNotify: true });
			yield* untilFinished(Backlog, ids.length);

			yield* outcomes({
				"attempts": [attemptCounts(Backlog), Object.fromEntries(ids.map((id) => [`job ${id}`, 1]))],
				"drained": [drained("app", Backlog), "before the worker's next poll"],
				"most running at once": [mostRunningAtOnce(Backlog), concurrency],
			});
		},
	);
}
