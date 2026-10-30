import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { interrupted, running, storedTogether } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const Interrupted = defineQueue({ name: "interrupted", queue: { expireInSeconds: 2, retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });

const batch = storedTogether(
	Interrupted,
	[0, 1, 2].map((id) => ({ as: `job ${id}`, data: { id }, priority: 10 - id })),
);
const interrupting = workerBy(Interrupted, ({ id }) => (id === 1 ? "interrupts itself" : "succeeds"));
const byPriority = { handsBatchesOver: "by priority" } as const;

database.it(
	"an attempt that interrupts itself keeps the jobs before it completed and leaves itself and the rest of its batch active",
	[batch],
	function* ({ attempts, start, storedStates, untilInterrupted }) {
		expect(yield* storedStates("interrupted")).toEqual({ "job 0": "created", "job 1": "created", "job 2": "created" });

		yield* start("app", [interrupting], byPriority);
		yield* untilInterrupted(Interrupted, 1);

		yield* outcomes({
			"attempts": [attempts(Interrupted), ["job 0", "job 1"]],
			"stored states": [storedStates("interrupted"), { "job 0": "completed", "job 1": "active", "job 2": "active" }],
		});
	},
);

database.it(
	"pg-boss fails the interrupted job and the rest of its batch once they expire",
	[batch, running("app", [interrupting], byPriority), interrupted(Interrupted, 1)],
	function* ({ job, storedStates, untilSettled }) {
		expect(yield* storedStates("interrupted")).toEqual({ "job 0": "completed", "job 1": "active", "job 2": "active" });

		yield* untilSettled(Interrupted, 3);

		yield* outcomes({
			"job 1": [job("job 1"), expect.objectContaining({ error: "handler execution exceeded 2s", state: "failed" })],
			"job 2": [job("job 2"), expect.objectContaining({ error: "handler execution exceeded 2s", state: "failed" })],
			"stored states": [storedStates("interrupted"), { "job 0": "completed", "job 1": "failed", "job 2": "failed" }],
		});
	},
);
