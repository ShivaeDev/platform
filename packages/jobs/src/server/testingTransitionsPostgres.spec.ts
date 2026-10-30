import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { controlled, enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Ruled = defineQueue({
	name: "ruled",
	queue: { retryLimit: 2 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"the idle wait returns once pg-boss's native timeout fails a stuck attempt",
	[running("app", [worker(Ruled, "hangs")], { controller: "test retries" })],
	function* ({ attempts, enqueue, job, untilIdle }) {
		expect(yield* attempts(Ruled)).toEqual([]);

		yield* enqueue("app", Ruled, { id: 14 }, { as: "job", expireInSeconds: 1, retryLimit: 0 });
		yield* untilIdle("app");

		yield* outcomes({
			attempts: [attempts(Ruled), ["job"]],
			job: [job("job"), expect.objectContaining({ error: expect.stringContaining("handler execution exceeded 1s"), retryCount: 0, state: "failed" })],
		});
	},
);

database.it(
	"each send keeps the attempt expiry rule in force when it was sent",
	[
		running("app", [worker(Ruled, { fails: "The worker fails this attempt" })], { controller: "test retries" }),
		enqueued(Ruled, { id: 11 }, { as: "unruled job", retryLimit: 0 }),
		controlled((testing) => testing.expireAfter(Ruled, 1), "expire the first ruled attempt"),
		enqueued(Ruled, { id: 12 }, { as: "first-claim job" }),
		controlled((testing) => testing.expireAfter(Ruled, 3), "expire the third ruled attempt"),
		enqueued(Ruled, { id: 13 }, { as: "third-claim job" }),
		controlled((testing) => testing.expireAfter(Ruled, 1), "expire the first ruled attempt"),
	],
	function* ({ attemptCounts, enqueue, job, untilIdle }) {
		expect(yield* job("third-claim job")).toMatchObject({ retryLimit: 2 });

		yield* enqueue("app", Ruled, { id: 13 }, { as: "third-claim job again", sameIdAs: "third-claim job" });
		yield* untilIdle("app");

		yield* outcomes({
			"attempts": [attemptCounts(Ruled), { "third-claim job": 2, "unruled job": 1 }],
			"first-claim job": [job("first-claim job"), expect.objectContaining({ error: "job timed out", retryCount: 0, retryLimit: 0, state: "failed" })],
			"third-claim job": [job("third-claim job"), expect.objectContaining({ error: "job timed out", retryCount: 2, retryLimit: 2, state: "failed" })],
			"unruled job": [job("unruled job"), expect.objectContaining({ retryCount: 0, retryLimit: 0, state: "failed" })],
		});
	},
);
