import { Duration, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { controlled, enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Stuck = defineQueue({
	name: "stuck",
	queue: { expireInSeconds: 60, policy: "standard", retryLimit: 2 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const expiringAfterOneSecond = controlled((testing) => testing.expireIn(Stuck, "1 second"), "expire stuck attempts after one second");

database.it(
	"an attempt stuck past the controller's expiry is interrupted and its retry completes",
	[running("app", [worker(Stuck, "hangs", "succeeds")], { controller: "test retries" }), expiringAfterOneSecond],
	function* ({ enqueue, interruptions, job, untilJob }) {
		expect(yield* interruptions(Stuck)).toEqual([]);

		yield* enqueue("app", Stuck, { id: 7 }, { as: "job" });
		yield* untilJob("job", "completed");

		yield* outcomes({
			interruptions: [interruptions(Stuck), [expect.stringMatching(/^job /u)]],
			job: [job("job"), expect.objectContaining({ expireInSeconds: 1, retryCount: 1, state: "completed" })],
		});
	},
);

database.it(
	"an attempt stuck through every retry is dead-lettered with pg-boss's handler timeout",
	[running("app", [worker(Stuck, "hangs")], { controller: "test retries" }), expiringAfterOneSecond],
	function* ({ deadLettered, enqueue, interruptions, job, untilDeadLettered }) {
		expect(yield* deadLettered(Stuck)).toEqual([]);

		yield* enqueue("app", Stuck, { id: 8 }, { as: "job", retryLimit: 1 });
		yield* untilDeadLettered(Stuck, 1);

		yield* outcomes({
			"dead-lettered": [deadLettered(Stuck), ["job"]],
			"interruptions": [interruptions(Stuck), [expect.stringMatching(/^job /u), expect.stringMatching(/^job /u)]],
			"job": [job("job"), expect.objectContaining({ error: "handler execution exceeded 1s", retryCount: 1, state: "failed" })],
		});
	},
);

database.it(
	"each send keeps the expiry in force when it was sent, even when sent again under a later rule",
	[
		running("app", [Stuck], { controller: "test retries" }),
		enqueued(Stuck, { id: 1 }, { as: "unruled job" }),
		controlled((testing) => testing.expireIn(Stuck, "1001 millis"), "expire stuck attempts after 1001 milliseconds"),
		enqueued(Stuck, { id: 2 }, { as: "rounded job" }),
		controlled((testing) => testing.expireIn(Stuck, "1 second"), "expire stuck attempts after one second"),
		enqueued(Stuck, { id: 3 }, { as: "later job" }),
	],
	function* ({ enqueue, job }) {
		expect(yield* job("rounded job")).toMatchObject({ expireInSeconds: 2 });

		yield* enqueue("app", Stuck, { id: 2 }, { as: "rounded job again", sameIdAs: "rounded job" });

		yield* outcomes({
			"later job": [job("later job"), expect.objectContaining({ expireInSeconds: 1 })],
			"rounded job": [job("rounded job"), expect.objectContaining({ expireInSeconds: 2 })],
			"unruled job": [job("unruled job"), expect.objectContaining({ expireInSeconds: 60 })],
		});
	},
);

for (const duration of ["999 millis", "0 seconds", "-1 second", Duration.infinity, Duration.millis(Number.NaN)] as const) {
	database.it(
		`the controller rejects an expiry of ${Duration.format(Duration.fromInputUnsafe(duration))} with a typed testing error`,
		[running("app", [Stuck], { controller: "test retries" })],
		function* ({ answered, askTesting }) {
			expect(yield* answered()).toBe("nothing asked yet");

			yield* askTesting("app", "expire stuck attempts after an unusable duration", (testing) => testing.expireIn(Stuck, duration));

			expect(yield* answered()).toBe("testing expireIn stuck failed with Expiry must be finite and at least one second");
		},
	);
}
