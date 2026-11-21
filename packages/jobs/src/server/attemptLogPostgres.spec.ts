import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, enqueuedEarlier, running, storedTogether, waiting } from "#test/postgres/traits.ts";
import { worker, workerBy } from "#test/workers.ts";

const Charges = defineQueue({ name: "attempt-log-charges", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });

database.it(
	"a failed attempt logs one error line with its queue, id, attempt and the failed outcome, and its failure with the credential masked",
	[
		running("app", [worker(Charges, { failsWith: { _tag: "ProviderRejected", status: 503, token: "provider-secret" } })]),
		enqueued(Charges, { id: 1 }, { as: "charge 1" }),
	],
	function* ({ recordedJobLog, untilJob }) {
		yield* untilJob("charge 1", "failed");

		expect(yield* recordedJobLog("charge 1")).toEqual([
			{
				annotations: { "job.attempt": 1, "job.id": "charge 1", "job.outcome": "failed", "job.queue": "attempt-log-charges" },
				failure: { _tag: "ProviderRejected", status: 503, token: "<redacted>" },
				level: "Error",
				message: "Job attempt failed",
			},
		]);
	},
);

const Decoded = defineQueue({ name: "attempt-log-decoded", queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.Number }) });
const Mistyped = defineQueue({ name: Decoded.name, queue: { retryLimit: 0 }, schema: Schema.Struct({ id: Schema.String }) });

database.it(
	"a payload that fails to decode logs one error line with the failed outcome and the decode failure",
	[storedTogether(Mistyped, [{ as: "mistyped charge", data: { id: "one" } }]), running("app", [worker(Decoded, "succeeds")])],
	function* ({ handled, recordedJobLog, untilJob }) {
		yield* untilJob("mistyped charge", "failed");

		yield* outcomes([
			["handled payloads", () => handled(Decoded), []],
			[
				"recorded job log",
				() => recordedJobLog("mistyped charge"),
				[
					{
						annotations: { "job.attempt": 1, "job.id": "mistyped charge", "job.outcome": "failed", "job.queue": "attempt-log-decoded" },
						failure: { direction: "decode", queue: "attempt-log-decoded" },
						level: "Error",
						message: "Job attempt failed",
					},
				],
			],
		]);
	},
);

const Deferring = defineQueue({
	name: "attempt-log-deferring",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({}),
	worker: { batchSize: 1, pollingIntervalSeconds: 0.5 },
});

database.it(
	"an attempt that defers with RetryAt and the attempt that then succeeds log no attempt line",
	[running("app", [worker(Deferring, { defers: "Provider busy", until: "now" }, "succeeds")])],
	function* ({ attemptCounts, enqueue, pollNow, recordedJobLog, untilJob }) {
		yield* enqueue("app", Deferring, {}, { as: "deferred charge" });
		yield* pollNow("app", Deferring);
		yield* untilJob("deferred charge", "completed");

		yield* outcomes([
			["attempts", () => attemptCounts(Deferring), { "deferred charge": 2 }],
			["recorded job log", () => recordedJobLog("deferred charge"), []],
		]);
	},
);

const Reports = defineQueue({ name: "attempt-log-reports", queue: { expireInSeconds: 1, retryLimit: 0 }, schema: Schema.Struct({}) });

database.it(
	"an attempt stopped at its deadline logs one error line with its queue, id, attempt and the deadline outcome, and none when pg-boss fails it",
	[running("app", [worker(Reports, "hangs")]), enqueued(Reports, {}, { as: "slow report" })],
	function* ({ recordedJobLog, timePasses, untilAttempts, untilJob }) {
		yield* untilAttempts(Reports, 1);
		expect(yield* recordedJobLog("slow report")).toEqual([]);

		yield* timePasses("1 second");
		yield* timePasses("500 millis");
		yield* untilJob("slow report", "failed");

		expect(yield* recordedJobLog("slow report")).toEqual([
			{
				annotations: { "job.attempt": 1, "job.id": "slow report", "job.outcome": "deadline", "job.queue": "attempt-log-reports" },
				failure: "none",
				level: "Error",
				message: "Job attempt hit its 1s deadline",
			},
		]);
	},
);

const Batched = defineQueue({
	name: "attempt-log-batched",
	queue: { retryLimit: 0 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { batchSize: 2 },
});

database.it(
	"a job whose window passed while the job before it in its batch ran is not run and logs one deadline line, and the completed job logs none",
	[
		storedTogether(Batched, [
			{ as: "long job", data: { id: 0 }, expireInSeconds: 4, priority: 10 },
			{ as: "late job", data: { id: 1 }, expireInSeconds: 1, priority: 9 },
		]),
		running("app", [workerBy(Batched, ({ id }) => (id === 0 ? { waitsFor: "long" } : "succeeds"))], { handsBatchesOver: "by priority" }),
		waiting("long", "the long job's handler is running"),
	],
	function* ({ attempts, open, recordedJobLog, timePasses, untilJob }) {
		yield* timePasses("1 second");
		yield* open("long");
		yield* untilJob("long job", "completed");
		yield* timePasses("3 seconds");
		yield* timePasses("500 millis");
		yield* untilJob("late job", "failed");

		yield* outcomes([
			["attempts", () => attempts(Batched), ["long job"]],
			[
				"late job log",
				() => recordedJobLog("late job"),
				[
					{
						annotations: { "job.attempt": 1, "job.id": "late job", "job.outcome": "deadline", "job.queue": "attempt-log-batched" },
						failure: "none",
						level: "Error",
						message: "Job attempt hit its 1s deadline",
					},
				],
			],
			["long job log", () => recordedJobLog("long job"), []],
		]);
	},
);

const Held = defineQueue({ name: "attempt-log-held", schema: Schema.Struct({}) });

database.it(
	"an attempt interrupted by a non-graceful shutdown logs no attempt line",
	[
		enqueuedEarlier(Held, {}, { as: "held job" }),
		running("app", [worker(Held, { waitsFor: "held" })], { stop: { graceful: false } }),
		waiting("held", "the held job's handler is running"),
	],
	function* ({ interruptions, recordedJobLog, stop }) {
		yield* stop("app");

		yield* outcomes([
			["interruptions", () => interruptions(Held), ["held job before its deadline"]],
			["recorded job log", () => recordedJobLog("held job"), []],
		]);
	},
);

database.it(
	"an attempt interrupted when the worker drain times out logs no attempt line",
	[
		enqueuedEarlier(Held, {}, { as: "held job" }),
		running("app", [worker(Held, { waitsFor: "held" })], { stop: { timeout: 1000 } }),
		waiting("held", "the held job's handler is running"),
	],
	function* ({ drainTimePasses, interruptions, recordedJobLog, stopInBackground, untilStopped, untilWorkersDrain }) {
		yield* stopInBackground("app");
		yield* untilWorkersDrain(1);
		yield* drainTimePasses(1000);
		yield* untilStopped("app");

		yield* outcomes([
			["interruptions", () => interruptions(Held), ["held job before its deadline"]],
			["recorded job log", () => recordedJobLog("held job"), []],
		]);
	},
);

database.it(
	"an attempt that pg-boss stops for its timeout before the runtime clock reaches the deadline logs no attempt line",
	[running("app", [worker(Reports, "hangs")]), enqueued(Reports, {}, { as: "overdue report" })],
	function* ({ pgBossClockPasses, recordedJobLog, runtimeClockCatchesUp, timePasses, untilAttempts, untilJob }) {
		yield* untilAttempts(Reports, 1);

		yield* pgBossClockPasses("1 second");
		yield* untilJob("overdue report", "failed");
		yield* runtimeClockCatchesUp("1 second");
		yield* timePasses("500 millis");

		expect(yield* recordedJobLog("overdue report")).toEqual([]);
	},
);

const LeftBehind = defineQueue({
	name: "attempt-log-left-behind",
	queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
	schema: Schema.Struct({ id: Schema.Number }),
	worker: { batchSize: 2, pollingIntervalSeconds: 0.5 },
});

database.it(
	"a job its batch leaves behind at another job's deadline logs no attempt line when pg-boss fails it for the timeout and it spends a retry",
	[
		storedTogether(LeftBehind, [
			{ as: "first job", data: { id: 0 }, expireInSeconds: 1, priority: 10 },
			{ as: "second job", data: { id: 1 }, expireInSeconds: 4, priority: 9 },
		]),
		running("app", [workerBy(LeftBehind, ({ id }, attempt) => (id === 0 && attempt === 0 ? "hangs" : "succeeds"))], {
			handsBatchesOver: "by priority",
		}),
	],
	function* ({ attemptCounts, job, recordedJobLog, timePasses, untilAttempts, untilInterrupted, untilSettled }) {
		yield* untilAttempts(LeftBehind, 1);
		yield* timePasses("1 second");
		yield* untilInterrupted(LeftBehind, 1);

		yield* timePasses("3 seconds");
		yield* timePasses("500 millis");
		yield* untilSettled(LeftBehind, 2);

		yield* outcomes([
			["attempts", () => attemptCounts(LeftBehind), { "first job": 2, "second job": 1 }],
			["second job", () => job("second job"), expect.objectContaining({ retryCount: 1, state: "completed" })],
			["second job log", () => recordedJobLog("second job"), []],
		]);
	},
);
