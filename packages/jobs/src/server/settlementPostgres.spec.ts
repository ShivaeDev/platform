import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { storedTogether } from "#test/postgres/traits.ts";
import { type Attempt, workerBy } from "#test/workers.ts";

const Settled = defineQueue({
	name: "settlement",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const batch = storedTogether(
	Settled,
	ids.map((id) => ({ as: `job ${id}`, data: { id } })),
);

const poisons: readonly { readonly attempt: Attempt; readonly outcome: string }[] = [
	{ attempt: { fails: "Poison job" }, outcome: "a failure" },
	{ attempt: { dies: "Poison job" }, outcome: "a defect" },
	{ attempt: { failsWithText: "Poison job" }, outcome: "a plain text failure" },
];

for (const { attempt, outcome } of poisons) {
	database.it(
		`${outcome} in one job of a batch of ten fails only that job`,
		[batch],
		function* ({ attemptCounts, job, start, storedStates, untilSettled }) {
			expect(Object.values(yield* storedStates("settlement"))).toEqual(ids.map(() => "created"));

			yield* start("app", [workerBy(Settled, ({ id }) => (id === 4 ? attempt : "succeeds"))]);
			yield* untilSettled(Settled, ids.length);

			yield* outcomes({
				"attempts": [attemptCounts(Settled), Object.fromEntries(ids.map((id) => [`job ${id}`, id === 4 ? 2 : 1]))],
				"job 4": [job("job 4"), expect.objectContaining({ error: "Error: Poison job", retryCount: 1, state: "failed" })],
				"stored states": [storedStates("settlement"), Object.fromEntries(ids.map((id) => [`job ${id}`, id === 4 ? "failed" : "completed"]))],
			});
		},
	);
}
