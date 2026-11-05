import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { database } from "#test/jobs/postgres/database.ts";
import { enqueued, fetchesWatched, running, waiting } from "#test/jobs/postgres/traits.ts";
import { worker, workerBy } from "#test/jobs/workers.ts";

const Checked = defineQueue({
	name: "checked",
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
});

const Other = defineQueue({ name: "other", schema: Checked.schema, worker: { pollingIntervalSeconds: 0.5 } });

database.it(
	"a controller waiting for a job returns it with its decoded data once a worker has completed it",
	[running("app", [worker(Checked, "succeeds")], { controller: "test retries" }), enqueued(Checked, { id: 42 }, { as: "check 42" })],
	function* ({ controllerAwaits }) {
		expect(yield* controllerAwaits("app", "check 42", "completed")).toEqual({ data: { id: 42 }, job: "check 42", state: "completed" });
	},
);

for (const clock of ["job budget", "job budget after an earlier clock advance"] as const) {
	database.it(
		`a controller that waits past its ${clock} fails with PgBossWaitError naming the expected and last seen states`,
		[running("app", [Checked], { controller: "test retries" }), enqueued(Checked, { id: 42 }, { as: "check 42" })],
		function* ({ budgetWaitResult, startJobBudgetWait, timePasses }) {
			if (clock === "job budget after an earlier clock advance") {
				yield* timePasses("1 hour");
			}
			yield* startJobBudgetWait("app", "check 42", "completed", "200 millis");
			yield* timePasses("200 millis");

			expect(yield* budgetWaitResult("app")).toEqual({
				error: "PgBossWaitError",
				message: "Gave up after 200ms waiting until job check 42 in checked is completed; last seen: created",
			});
		},
	);
}

database.it(
	"a fetch wait ignores another queue while its worker is busy and passes when its own queue takes the next job",
	[
		running("app", [worker(Checked, { waitsFor: "busy" }), worker(Other, "succeeds")], { controller: "test retries" }),
		enqueued(Checked, { id: 1 }, { as: "check 1" }),
		waiting("busy", "check 1 holds the checked worker at the busy gate"),
		enqueued(Checked, { id: 2 }, { as: "check 2" }),
		fetchesWatched("app", Checked, 1),
	],
	function* ({ fetchWatch, job, open, untilFetchesPass, untilFetchWatchPasses }) {
		yield* untilFetchesPass(Other, 1);

		expect(yield* fetchWatch("app")).toBe("still waiting");

		yield* open("busy");
		yield* untilFetchWatchPasses("app");

		expect(yield* job("check 2")).toMatchObject({ state: expect.stringMatching(/^(?:active|completed)$/u) });
	},
);

database.it(
	"a controller that waits past its budget for fetches of a queue no worker polls fails with PgBossWaitError naming how many fetches passed",
	[running("app", [Checked], { controller: "test retries" })],
	function* ({ budgetWaitResult, startFetchBudgetWait, timePasses }) {
		yield* startFetchBudgetWait("app", Checked, 1, "200 millis");
		yield* timePasses("200 millis");

		expect(yield* budgetWaitResult("app")).toEqual({
			error: "PgBossWaitError",
			message: "Gave up after 200ms waiting until 1 checked fetch that began after the wait has finished; last seen: 0 finished",
		});
	},
);

database.it(
	"a controller waiting for two fetches stays pending after the first and passes when the second takes the next job",
	[
		running(
			"app",
			[
				workerBy(Checked, ({ id }) => {
					if (id === 1) {
						return { waitsFor: "first" };
					}
					if (id === 2) {
						return { waitsFor: "second" };
					}
					return "succeeds";
				}),
			],
			{ controller: "test retries" },
		),
		enqueued(Checked, { id: 1 }, { as: "check 1" }),
		waiting("first", "check 1 holds the worker before the fetch wait starts"),
		enqueued(Checked, { id: 2 }, { as: "check 2" }),
		enqueued(Checked, { id: 3 }, { as: "check 3" }),
		fetchesWatched("app", Checked, 2),
	],
	function* ({ fetchWatch, job, open, untilWaiting, untilFetchWatchPasses, pollNow }) {
		yield* open("first");
		yield* pollNow("app", Checked);
		yield* untilWaiting("second");

		expect(yield* fetchWatch("app")).toBe("still waiting");

		yield* open("second");
		yield* pollNow("app", Checked);
		yield* untilFetchWatchPasses("app");

		expect(yield* job("check 3")).toMatchObject({ state: expect.stringMatching(/^(?:active|completed)$/u) });
	},
);
