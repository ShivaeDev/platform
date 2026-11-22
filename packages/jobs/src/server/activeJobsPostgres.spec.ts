import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { retriedUntilWaiting } from "#test/postgres/retriedUntilWaiting.ts";
import { enqueued, enqueuedUntil, running, waiting } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const Reports = defineQueue({
	name: "running-reports",
	queue: { expireInSeconds: 45, retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const reportWorker = workerBy(Reports, ({ id }, attempt) => {
	if (id === 1) {
		return "succeeds";
	}
	if (id === 2) {
		return { fails: "The report cannot be built" };
	}
	return attempt === 0 ? { fails: "The first attempt fails" } : { waitsFor: "report 3" };
});

const reportHeld = [
	running("app", [reportWorker]),
	enqueuedUntil(Reports, { id: 1 }, { as: "report 1" }, "completed"),
	enqueuedUntil(Reports, { id: 2 }, { as: "report 2", retryLimit: 0 }, "failed"),
	enqueued(Reports, { id: 3 }, { as: "report 3" }),
	retriedUntilWaiting("report 3", "report 3 failed its first attempt and its handler holds the second"),
];

database.it(
	"the active listing holds only the held job, on its second attempt, with a deadline of its start plus its expiry, while the completed and failed jobs stay out",
	reportHeld,
	function* ({ activeListed }) {
		expect(yield* activeListed("app", Reports)).toEqual({
			jobs: [{ attempt: 2, deadline: "45s after its start", job: "report 3", queue: "running-reports", timeLeft: "45s" }],
			next: "no further page",
		});
	},
);

database.it(
	"a held job's time left shrinks as PostgreSQL's clock passes while the runtime clock stands still",
	reportHeld,
	function* ({ activeListed, pgBossClockPasses }) {
		expect((yield* activeListed("app", Reports)).jobs).toMatchObject([{ timeLeft: "45s" }]);

		yield* pgBossClockPasses("10 seconds");

		expect((yield* activeListed("app", Reports)).jobs).toMatchObject([{ job: "report 3", timeLeft: "35s" }]);
	},
);

const Paged = defineQueue({
	name: "running-paged",
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { batchSize: 1, localConcurrency: 2, pollingIntervalSeconds: 0.5 },
});

database.it(
	"active jobs page oldest start first, one job a page",
	[
		running("app", [workerBy(Paged, ({ id }) => ({ waitsFor: `report ${id}` }))]),
		enqueued(Paged, { id: 1 }, { as: "report 1" }),
		waiting("report 1", "report 1's handler holds it"),
	],
	function* ({ activePages, enqueue, pgBossClockPasses, untilWaiting }) {
		yield* enqueue("app", Paged, { id: 2 }, { as: "report 2" });
		yield* pgBossClockPasses("5 seconds");
		yield* untilWaiting("report 2");

		expect(yield* activePages("app", Paged, 1)).toEqual([["report 1"], ["report 2"]]);
	},
);
