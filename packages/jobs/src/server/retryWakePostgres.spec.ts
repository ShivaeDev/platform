import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { reached, running, storedTogether, waiting } from "#test/postgres/traits.ts";
import { worker, workerBy } from "#test/workers.ts";

const slowPoll = { pollingIntervalSeconds: 60 };
const Woken = defineQueue({
	name: "woken",
	queue: { retryBackoff: false, retryDelay: 1, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: slowPoll,
});
const waitingJob = storedTogether(Woken, [{ as: "job", data: {} }]);
const failingOnce = worker(Woken, { fails: "Try again" }, "succeeds");

database.it(
	"a failed attempt runs again once its retry delay ends, without waiting for the worker's next poll",
	[waitingJob],
	function* ({ attempts, start, untilJob, wakes }) {
		yield* start("app", [failingOnce], { schedule: false, supervise: false });
		yield* untilJob("job", "completed");

		yield* outcomes({
			attempts: [attempts(Woken), ["job", "job"]],
			wakes: [wakes("app"), ["idle worker"]],
		});
	},
);

const Replaced = defineQueue({
	name: "woken",
	queue: { retryBackoff: false, retryDelay: 3, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: slowPoll,
});
const Replacement = defineQueue({
	name: "woken",
	queue: { retryBackoff: false, retryDelay: 3, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"a runtime that has stopped never wakes its worker for a pending retry",
	[storedTogether(Replaced, [{ as: "job", data: {} }]), running("app", [worker(Replaced, { fails: "Try again" })]), reached("job", "retry")],
	function* ({ attempts, start, stop, untilJob, wakes }) {
		yield* stop("app");
		yield* start("replacement", [worker(Replacement, "succeeds")]);
		yield* untilJob("job", "completed");

		yield* outcomes({
			"app wakes": [wakes("app"), []],
			"attempts": [attempts(Replaced), ["job", "job"]],
		});
	},
);

const Siblings = defineQueue({
	name: "siblings",
	queue: { notify: false, retryBackoff: false, retryDelay: 1, retryLimit: 1 },
	schema: Schema.Struct({ holds: Schema.Boolean }),
	worker: { batchSize: 1, localConcurrency: 2, ...slowPoll },
});

database.it(
	"a retry wakes the idle sibling worker while the other worker is still busy",
	[
		storedTogether(Siblings, [{ as: "held job", data: { holds: true } }]),
		running(
			"app",
			[
				workerBy(Siblings, ({ holds }, attempt) => {
					if (holds) {
						return { waitsFor: "held" };
					}
					return attempt === 0 ? { fails: "Try again" } : "succeeds";
				}),
			],
			{
				schedule: false,
				supervise: false,
			},
		),
		waiting("held", "one worker is busy with the held job"),
	],
	function* ({ attempts, enqueue, job, pollNow, untilJob, wakes }) {
		yield* enqueue("app", Siblings, { holds: false }, { as: "job" });
		yield* pollNow("app", Siblings);
		yield* untilJob("job", "completed");

		yield* outcomes({
			"attempts": [attempts(Siblings), ["held job", "job", "job"]],
			"held job": [job("held job"), expect.objectContaining({ state: "active" })],
			"wakes": [wakes("app"), ["busy worker", "idle worker"]],
		});
	},
);
