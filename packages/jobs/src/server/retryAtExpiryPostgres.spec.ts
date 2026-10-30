import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { claimedAndExpired, deferred, deletedJob, enqueued, running, stoppedAfterwards } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const timeouts = [
	{ cause: "expiry", error: "job timed out", expireInSeconds: 1 },
	{ cause: "heartbeat", error: "job heartbeat timeout", expireInSeconds: 900 },
] as const;

for (const { cause, error, expireInSeconds } of timeouts) {
	const Limited = defineQueue({
		name: `limited-${cause}`,
		queue: { expireInSeconds, heartbeatSeconds: 10, maxDeferrals: 1, retryBackoff: false, retryDelay: 0, retryLimit: 2 },
		schema: Schema.Struct({}),
		worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
	});
	const deferringTwice = worker(Limited, { defers: "Quota", until: "tomorrow" }, { defers: "Quota after timeout", until: "tomorrow" }, "succeeds");

	database.it(
		`a deferred job keeps its deferral limit after a native ${cause} timeout replaced its output`,
		[
			running("first", [deferringTwice]),
			enqueued(Limited, {}, { as: "job", by: "first" }),
			deferred(Limited, 1, "first"),
			stoppedAfterwards("first"),
			claimedAndExpired("job", cause),
		],
		function* ({ attempts, job, start, untilJob }) {
			expect(yield* job("job")).toMatchObject({ error, state: "retry" });

			yield* start("second", [deferringTwice]);
			yield* untilJob("job", "completed");

			yield* outcomes({
				"attempts": [attempts(Limited), ["job", "job", "job"]],
				"job": [job("job"), expect.objectContaining({ retryCount: 2 })],
			});
		},
	);
}

const Reused = defineQueue({
	name: "reused",
	queue: { maxDeferrals: 1, retryLimit: 0 },
	schema: Schema.Struct({}),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"a job enqueued under the id of a deleted deferred job starts with a fresh deferral budget",
	[
		running("app", [worker(Reused, { defers: "Quota", until: "tomorrow" })]),
		enqueued(Reused, {}, { as: "job" }),
		deferred(Reused, 1),
		deletedJob("job"),
	],
	function* ({ enqueue, job, untilDeferred }) {
		expect(yield* job("job")).toBe("missing");

		yield* enqueue("app", Reused, {}, { as: "reused job", sameIdAs: "job" });
		yield* untilDeferred("app", Reused, 1);

		expect(yield* job("reused job")).toMatchObject({ retryCount: 0, state: "retry" });
	},
);
