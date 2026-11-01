import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Backoff = defineQueue({
	name: "backoff-counts",
	queue: { retryLimit: 2 },
	schema: Schema.Struct({}),
	worker: { pollingIntervalSeconds: 0.5 },
});

const backoffWorker = worker(
	Backoff,
	{ defers: "Quota", until: "tomorrow" },
	{ fails: "Temporary failure" },
	{ defers: "Quota", until: "tomorrow" },
	{ fails: "Again" },
	"succeeds",
);

database.it(
	"handlers see independent retry and deferral counts across failures, deferrals and a worker restart",
	[running("app", [backoffWorker], { controller: "test retries" }), enqueued(Backoff, {}, { as: "backoff" })],
	function* ({ handlerCounts, runDueNow, start, stop, untilDeferred, untilIdle }) {
		yield* untilDeferred("app", Backoff, 1);
		yield* untilIdle("app");
		expect(yield* handlerCounts(Backoff)).toEqual([{ deferralCount: 0, retryCount: 0 }]);

		yield* stop("app");
		yield* start("app", [backoffWorker], {
			controller: "test retries",
		});
		yield* runDueNow("app", Backoff);
		yield* untilDeferred("app", Backoff, 1);
		yield* untilIdle("app");

		expect(yield* handlerCounts(Backoff)).toEqual([
			{ deferralCount: 0, retryCount: 0 },
			{ deferralCount: 1, retryCount: 0 },
			{ deferralCount: 1, retryCount: 1 },
		]);

		yield* runDueNow("app", Backoff);
		yield* untilIdle("app");

		expect(yield* handlerCounts(Backoff)).toEqual([
			{ deferralCount: 0, retryCount: 0 },
			{ deferralCount: 1, retryCount: 0 },
			{ deferralCount: 1, retryCount: 1 },
			{ deferralCount: 2, retryCount: 1 },
			{ deferralCount: 2, retryCount: 2 },
		]);
	},
);
