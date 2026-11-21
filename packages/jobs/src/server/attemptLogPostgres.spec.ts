import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Charges = defineQueue({ name: "attempt-log-charges", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });
const Reports = defineQueue({ name: "attempt-log-reports", queue: { expireInSeconds: 1, retryLimit: 0 }, schema: Schema.Struct({}) });

database.it(
	"a failed attempt writes no log line naming its job",
	[
		running("app", [worker(Charges, { failsWith: { _tag: "ProviderRejected", status: 503, token: "provider-secret" } })]),
		enqueued(Charges, { id: 1 }, { as: "charge 1" }),
	],
	function* ({ recordedJobLog, untilJob }) {
		yield* untilJob("charge 1", "failed");

		expect(yield* recordedJobLog("charge 1")).toEqual([]);
	},
);

database.it(
	"an attempt stopped at its deadline writes no log line naming its job, before or after pg-boss fails it",
	[running("app", [worker(Reports, "hangs")]), enqueued(Reports, {}, { as: "slow report" })],
	function* ({ recordedJobLog, timePasses, untilAttempts, untilInterrupted, untilJob }) {
		yield* untilAttempts(Reports, 1);
		yield* timePasses("1 second");
		yield* untilInterrupted(Reports, 1);
		expect(yield* recordedJobLog("slow report")).toEqual([]);

		yield* timePasses("500 millis");
		yield* untilJob("slow report", "failed");

		expect(yield* recordedJobLog("slow report")).toEqual([]);
	},
);
