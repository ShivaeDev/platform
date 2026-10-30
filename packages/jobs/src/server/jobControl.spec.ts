import type { Effect } from "effect";
import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import type { PgBossService } from "#service.ts";
import { clientFrom, running, runtime, storedJob } from "#test/runtime/kit.ts";
import { scriptedClient } from "#test/runtime/scriptedClient.ts";
import { storedJob as stored } from "#test/runtime/storedJob.ts";

const Control = defineQueue({ name: "control", schema: Schema.Struct({ id: Schema.NumberFromString }) });

runtime.it(
	"looking a job up by id answers its decoded payload with pg-boss's metadata",
	[storedJob(stored("control", "job-42", { id: "42" })), storedJob(stored("control", "job-43", { id: "43" })), running("app")],
	function* ({ answered, ask }) {
		yield* ask("app", "look up job-42", (jobs) => jobs.getJob(Control, "job-42"));

		expect(yield* answered()).toEqual({ ...stored("control", "job-42", { id: "42" }), data: { id: 42 }, signal: expect.any(AbortSignal) });
	},
);

runtime.it("looking up an unknown job id answers nothing", [running("app")], function* ({ answered, ask }) {
	yield* ask("app", "look up a missing job", (jobs) => jobs.getJob(Control, "missing"));

	expect(yield* answered()).toBe("nothing");
});

runtime.it(
	"looking up a job whose stored payload no longer decodes fails with a decode error",
	[storedJob(stored("control", "job-bad", { id: null })), running("app")],
	function* ({ answered, ask }) {
		yield* ask("app", "look up job-bad", (jobs) => jobs.getJob(Control, "job-bad"));

		expect(yield* answered()).toBe('decode control payload failed with Expected string\n  at ["id"]');
	},
);

for (const state of ["active", "completed", "cancelled", "created"] as const) {
	runtime.it(
		`retrying a ${state} job leaves it unchanged`,
		[storedJob(stored("control", "job-1", { id: "1" }, state)), running("app")],
		function* ({ ask, clientCalls }) {
			yield* ask("app", "retry job-1", (jobs) => jobs.retry(Control, "job-1"));

			expect(yield* clientCalls()).toEqual(["start"]);
		},
	);
}

runtime.it("retrying an unknown job id changes nothing", [running("app")], function* ({ ask, clientCalls }) {
	yield* ask("app", "retry a missing job", (jobs) => jobs.retry(Control, "missing"));

	expect(yield* clientCalls()).toEqual(["start"]);
});

const capabilityless = clientFrom(() => scriptedClient({}), "the custom pg-boss client offers no job lookup, retry, update or database access");

const operations: ReadonlyArray<{
	readonly operation: string;
	readonly missing: string;
	readonly call: (jobs: PgBossService) => Effect.Effect<unknown, unknown>;
}> = [
	{ call: (jobs) => jobs.counts(Control), missing: "getDb", operation: "counts" },
	{ call: (jobs) => jobs.deadLetteredJobs(Control, { limit: 1 }), missing: "getDb", operation: "deadLetteredJobs" },
	{ call: (jobs) => jobs.failedJobs(Control, { limit: 1 }), missing: "getDb", operation: "failedJobs" },
	{ call: (jobs) => jobs.getJob(Control, "job-1"), missing: "findJobs", operation: "getJob" },
	{ call: (jobs) => jobs.retry(Control, "job-1"), missing: "findJobs, retry and update", operation: "retry" },
];

for (const { call, missing, operation } of operations) {
	runtime.it(
		`on a client without ${missing}, ${operation} fails with a typed ${operation} error naming what is missing`,
		[capabilityless, running("app")],
		function* ({ answered, ask }) {
			yield* ask("app", operation, call);

			expect(yield* answered()).toBe(`${operation} control failed with This pg-boss client does not support ${missing}`);
		},
	);
}
