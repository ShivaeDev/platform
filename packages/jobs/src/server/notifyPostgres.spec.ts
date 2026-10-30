import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, enqueuedUntil, running, waiting } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const POLLING_INTERVAL_SECONDS = 10;

const Notified = defineQueue({
	name: "notified",
	queue: { notify: true },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: POLLING_INTERVAL_SECONDS },
});

const listening = running("app", [workerBy(Notified, ({ id }) => (id === 42 ? { waitsFor: "release" } : "succeeds"))], { useListenNotify: true });
const polledLast = enqueuedUntil(Notified, { id: 1 }, { as: "job 1" }, "completed");

database.it(
	"a job on a notify queue starts well before its idle worker's next poll",
	[listening, polledLast],
	function* ({ enqueue, secondsUntilFirstAttempt, untilWaiting }) {
		yield* enqueue("app", Notified, { id: 42 }, { as: "job 42" });

		yield* untilWaiting("release");
		expect(yield* secondsUntilFirstAttempt("job 42")).toBeLessThan(POLLING_INTERVAL_SECONDS / 2);
	},
);

database.it(
	"counts report a running job as active and the same job as done once it completes",
	[listening, enqueued(Notified, { id: 42 }, { as: "job 42" }), waiting("release")],
	function* ({ answered, ask, open, untilJob }) {
		yield* ask("app", "count notified jobs", (jobs) => jobs.counts(Notified));
		expect(yield* answered()).toEqual({ activeCount: 1, failedCount: 0, queuedCount: 0, totalCount: 1 });

		yield* open("release");
		yield* untilJob("job 42", "completed");

		yield* ask("app", "count notified jobs", (jobs) => jobs.counts(Notified));
		expect(yield* answered()).toEqual({ activeCount: 0, failedCount: 0, queuedCount: 0, totalCount: 1 });
	},
);
