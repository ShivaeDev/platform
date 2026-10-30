import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, fetchesWatched, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Checked = defineQueue({
	name: "checked",
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});

database.it(
	"a controller waiting for a job returns it with its decoded data once a worker has completed it",
	[running("app", [worker(Checked, "succeeds")], { controller: "test retries" }), enqueued(Checked, { id: 42 }, { as: "check 42" })],
	function* ({ controllerAwaits }) {
		expect(yield* controllerAwaits("app", "check 42", "completed")).toEqual({ data: { id: 42 }, job: "check 42", state: "completed" });
	},
);

for (const clock of ["live", "test"] as const) {
	database.it(
		`a controller that waits past its budget of wall time for a job on the story's ${clock} clock names the state it waited for and the state it last saw`,
		[running("app", [Checked], { controller: "test retries" }), enqueued(Checked, { id: 42 }, { as: "check 42" })],
		function* ({ controllerAwaits }) {
			expect(yield* controllerAwaits("app", "check 42", "completed", "200 millis")).toBe(
				"Gave up after 200ms waiting until job check 42 in checked is completed; last seen: created",
			);
		},
		{ clock },
	);
}

database.it(
	"a controller waiting for a fetch keeps waiting while the only worker is busy and passes once a later fetch has taken the next job",
	[
		running("app", [worker(Checked, { waitsFor: "busy" })], { controller: "test retries" }),
		enqueued(Checked, { id: 1 }, { as: "check 1" }),
		waiting("busy", "check 1 holds the only worker at the busy gate"),
		enqueued(Checked, { id: 2 }, { as: "check 2" }),
		fetchesWatched("app", Checked, 1),
	],
	function* ({ fetchWatch, job, open, untilFetchWatchPasses }) {
		expect(yield* fetchWatch("app")).toBe("still waiting");

		yield* open("busy");
		yield* untilFetchWatchPasses("app");

		expect(yield* job("check 2")).toMatchObject({ state: expect.stringMatching(/^(?:active|completed)$/u) });
	},
);

database.it(
	"a controller that waits past its budget for fetches of a queue no worker polls names how many fetches passed",
	[running("app", [Checked], { controller: "test retries" })],
	function* ({ controllerAwaitsFetches }) {
		expect(yield* controllerAwaitsFetches("app", Checked, 1, "200 millis")).toBe(
			"Gave up after 200ms waiting until 1 checked fetch that began after the wait has finished; last seen: 0 finished",
		);
	},
);
