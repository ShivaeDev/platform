import { Schema } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running, storedTogether } from "#test/postgres/traits.ts";
import { workerBy } from "#test/workers.ts";

const WakeReads = defineQueue({ name: "wake-read-failure", queue: { retryLimit: 1 }, schema: Schema.Struct({ id: Schema.Number }) });

database.it(
	"when the lookup that would wake a retry fails, the failure is logged as a settle error and the rest of the batch completes",
	[
		storedTogether(
			WakeReads,
			[0, 1, 2].map((id) => ({ as: `job ${id}`, data: { id }, priority: 10 - id, retryLimit: id === 0 ? 0 : 1 })),
		),
		running("app", [workerBy(WakeReads, ({ id }) => (id === 0 ? { fails: "handler failed" } : "succeeds"))], {
			handsBatchesOver: "by priority",
			jobLookupsFailWith: "retry lookup failed",
		}),
	],
	function* ({ logged, storedStates, untilLogged, untilSettled }) {
		yield* untilSettled(WakeReads, 3);
		yield* untilLogged("wake-read-failure");

		yield* outcomes({
			"logs": [logged("app"), [{ level: "Error", message: "pg-boss settle for queue wake-read-failure failed: Error" }]],
			"stored states": [storedStates(WakeReads.name), { "job 0": "failed", "job 1": "completed", "job 2": "completed" }],
		});
	},
);
