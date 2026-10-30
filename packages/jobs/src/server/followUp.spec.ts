import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { deliveredWhileRegistering, running, runtime } from "#test/runtime/kit.ts";
import { type Attempt, scheduled, worker } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Source = defineQueue({ name: "source", schema: Schema.Struct({}) });
const Target = defineQueue({ name: "target", schema: Schema.Struct({ note: Schema.String }) });
const Hourly = defineSchedule({ cron: "0 * * * *", name: "hourly" });
const enqueuesTarget: Attempt = { enqueues: (jobs) => jobs.enqueue(Target, { note: "follow-up" }) };

runtime.it("every registered queue exists before the first worker starts", [], function* ({ clientCalls, start }) {
	yield* start("app", [worker(Source, "succeeds"), Target]);

	expect(yield* clientCalls()).toEqual([
		"start",
		"create queue source-dlq",
		"create queue source",
		"create queue target-dlq",
		"create queue target",
		"work source",
	]);
});

runtime.it(
	"a job pg-boss delivers while its worker registers already enqueues follow-up work through the runtime's service",
	[deliveredWhileRegistering("source", {})],
	function* ({ sent, settlements, start }) {
		yield* start("app", [worker(Source, enqueuesTarget), Target]);

		yield* outcomes({
			"sent": [sent(), [{ data: expect.objectContaining({ payload: { note: "follow-up" } }), name: "target", options: undefined }]],
			"settlements": [settlements(), ["source-delivered-on-work completed"]],
		});
	},
);

runtime.it(
	"a scheduled run enqueues follow-up work through the runtime's jobs service",
	[running("app", [scheduled(Hourly, enqueuesTarget), Target])],
	function* ({ deliver, sent }) {
		yield* deliver("hourly", [{ data: null, id: "hourly-run" }]);

		expect(yield* sent()).toMatchObject([{ data: { payload: { note: "follow-up" } }, name: "target" }]);
	},
);
