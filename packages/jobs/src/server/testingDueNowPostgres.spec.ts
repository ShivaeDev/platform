import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Notes = defineQueue({
	key: ({ id }) => id,
	name: "debounced-notes",
	queue: { policy: "singleton" },
	schema: Schema.Struct({ id: Schema.String }),
	worker: { pollingIntervalSeconds: 600 },
});
const Other = defineQueue({ name: "other-notes", schema: Notes.schema, worker: { pollingIntervalSeconds: 0.5 } });

for (const schema of ["pgboss", "custom_jobs"]) {
	database.it(
		`in ${schema}, a delayed send stays idle until made due, runs once and leaves other queues delayed`,
		[
			running("app", [worker(Notes, "succeeds"), worker(Other, "succeeds")], { schema }),
			enqueued(Notes, { id: "note" }, { as: "note", startAfter: 3600 }),
			enqueued(Other, { id: "other" }, { as: "other note", startAfter: 3600 }),
		],
		function* ({ handled, runDueNow, untilFetchesPass, untilIdle }) {
			yield* untilIdle("app");
			expect(yield* handled(Notes)).toEqual([]);

			yield* runDueNow("app", Notes);
			yield* untilIdle("app");
			yield* untilFetchesPass(Other, 1);

			yield* outcomes([
				["handled notes", () => handled(Notes), [{ id: "note" }]],
				["other notes", () => handled(Other), []],
			]);

			yield* runDueNow("app", Notes);
			yield* untilIdle("app");

			expect(yield* handled(Notes)).toEqual([{ id: "note" }]);
		},
	);
}

const Retrying = defineQueue({
	name: "delayed-retry",
	queue: { retryBackoff: false, retryDelay: 3600, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"making jobs due runs a delayed native retry once with its retry count",
	[running("app", [worker(Retrying, { fails: "Try again later" }, "succeeds")]), enqueued(Retrying, {}, { as: "retry" })],
	function* ({ handlerCounts, runDueNow, untilIdle, untilJob }) {
		yield* untilJob("retry", "retry");
		yield* untilIdle("app");
		expect(yield* handlerCounts(Retrying)).toEqual([{ deferralCount: 0, retryCount: 0 }]);

		yield* runDueNow("app", Retrying);
		yield* untilIdle("app");

		expect(yield* handlerCounts(Retrying)).toEqual([
			{ deferralCount: 0, retryCount: 0 },
			{ deferralCount: 0, retryCount: 1 },
		]);
	},
);
