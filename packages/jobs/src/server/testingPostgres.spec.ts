import { Effect, Option, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { controlled, enqueued, idleReadsCounted, idleWaitStarted, running, sent, waiting, watchingForChange } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";
import type { PgBossTesting } from "#testing.ts";

const Checked = defineQueue({
	name: "checked",
	queue: { expireInSeconds: 60, retryLimit: 2 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});
const Other = defineQueue({ name: "other", schema: Checked.schema });

for (const underSpan of [undefined, "sender"]) {
	database.it(
		`the testing controller reads a job ${underSpan === undefined ? "sent plainly" : "sent under a span"} decoded through its queue schema`,
		[running("app", [Checked], { controller: "test retries" })],
		function* ({ controllerJobs, enqueue }) {
			expect(yield* controllerJobs("app", Checked)).toEqual([]);

			yield* enqueue("app", Checked, { id: 42 }, { as: "job", ...(underSpan === undefined ? {} : { underSpan }) });

			expect(yield* controllerJobs("app", Checked)).toEqual([{ data: { id: 42 }, job: "job", state: "created" }]);
		},
	);
}

database.it(
	"the testing controller rejects stored data its readout schema cannot decode",
	[running("app", [Checked], { controller: "test retries" }), enqueued(Checked, { id: 42 }, { as: "job" })],
	function* ({ controllerJobs }) {
		expect(yield* controllerJobs("app", Checked)).toEqual([{ data: { id: 42 }, job: "job", state: "created" }]);

		const incompatible = defineQueue({ name: Checked.name, schema: Schema.Struct({ id: Schema.Number }) });

		expect(yield* controllerJobs("app", incompatible)).toEqual(expect.stringMatching(/^decode checked payload failed with /u));
	},
);

const failingNextChecked = [
	running("app", [Checked, Other], { controller: "test retries" }),
	controlled((testing) => testing.failNextSend(Checked), "fail the next checked send"),
];

for (const { answer, queue } of [
	{ answer: "enqueue checked failed with Injected pg-boss send failure", queue: Checked },
	{ answer: "job", queue: Other },
]) {
	database.it(
		`a failed next send for the checked queue answers a send to ${queue.name} with ${answer}`,
		failingNextChecked,
		function* ({ answered, enqueue, storedStates }) {
			expect(yield* storedStates(queue.name)).toEqual({});

			yield* enqueue("app", queue, { id: 1 }, { as: "job" });

			expect(yield* answered()).toBe(answer);
		},
	);
}

database.it(
	"a failed next send is used up by the one send it fails",
	[...failingNextChecked, sent(Checked, { id: 1 }, { as: "job 1" })],
	function* ({ answered, enqueue, storedPayloads }) {
		expect(yield* storedPayloads(Checked)).toEqual([]);

		yield* enqueue("app", Checked, { id: 2 }, { as: "job 2" });

		yield* outcomes({
			"answer": [answered(), "job 2"],
			"stored": [storedPayloads(Checked), [Option.some({ id: 2 })]],
		});
	},
);

const retrySettings = { retryBackoff: true, retryDelay: 120, retryDelayMax: 240, retryLimit: 1 };

for (const { controller, stored } of [
	{ controller: "test retries", stored: { retryBackoff: false, retryDelay: 0, retryLimit: 1 } },
	{ controller: "production retries", stored: { retryBackoff: true, retryDelay: 120, retryLimit: 1 } },
] as const) {
	database.it(
		`a controller with ${controller} stores a send's retry settings as ${stored.retryDelay} second delays`,
		[running("app", [Checked], { controller })],
		function* ({ enqueue, job, storedStates }) {
			expect(yield* storedStates("checked")).toEqual({});

			yield* enqueue("app", Checked, { id: 8 }, { as: "job", ...retrySettings });

			expect(yield* job("job")).toMatchObject(stored);
		},
	);
}

const expiringOnThird = [
	running("app", [worker(Checked, { fails: "The worker fails this attempt" })], { controller: "test retries" }),
	controlled((testing) => testing.expireAfter(Checked, 3), "expire the third checked attempt"),
];

database.it(
	"a job the controller expires on its third claim fails with pg-boss's timeout without running a third time",
	expiringOnThird,
	function* ({ attempts, deadLettered, enqueue, job, untilDeadLettered }) {
		expect(yield* attempts(Checked)).toEqual([]);

		yield* enqueue("app", Checked, { id: 7 }, { as: "job" });
		yield* untilDeadLettered(Checked, 1);

		yield* outcomes({
			"attempts": [attempts(Checked), ["job", "job"]],
			"dead-lettered": [deadLettered(Checked), ["job"]],
			"job": [job("job"), expect.objectContaining({ error: "job timed out", retryCount: 2, state: "failed" })],
		});
	},
);

database.it(
	"a job that succeeds before the controller's expiry attempt completes on its first attempt",
	[
		running("app", [worker(Checked, "succeeds")], { controller: "test retries" }),
		controlled((testing) => testing.expireAfter(Checked, 3), "expire the third checked attempt"),
	],
	function* ({ attempts, enqueue, job, untilJob }) {
		expect(yield* attempts(Checked)).toEqual([]);

		yield* enqueue("app", Checked, { id: 9 }, { as: "job" });
		yield* untilJob("job", "completed");

		yield* outcomes({
			attempts: [attempts(Checked), ["job"]],
			job: [job("job"), expect.objectContaining({ retryCount: 0, state: "completed" })],
		});
	},
);

const changes = [
	{
		change: "a send after it began waiting",
		setup: [running("app", [Checked], { controller: "test retries" }), watchingForChange("app")],
	},
	{
		change: "a worker finishing a running job",
		setup: [
			running("app", [worker(Checked, { waitsFor: "running" })], { controller: "test retries" }),
			enqueued(Checked, { id: 1 }, { as: "running job" }),
			waiting("running", "the running job waits at the running gate"),
			watchingForChange("app"),
		],
	},
] as const;

for (const { change, setup } of changes) {
	database.it(`a controller waiting for a change wakes for ${change}`, setup, function* ({ changeWatch, enqueue, open, untilChanged }) {
		expect(yield* changeWatch("app")).toBe("still waiting");

		yield* change === "a send after it began waiting" ? enqueue("app", Checked, { id: 2 }, { as: "job" }) : open("running");
		yield* untilChanged("app");

		expect(yield* changeWatch("app")).toBe("woke for a later revision");
	});
}

database.it(
	"a controller that starts waiting after a change since its mark wakes at once",
	[running("app", [Checked], { controller: "test retries" })],
	function* ({ changeWatch, enqueue, markRevision, untilChanged, watchForChange }) {
		yield* markRevision("app");
		yield* enqueue("app", Checked, { id: 3 }, { as: "job" });

		yield* watchForChange("app", "the mark");
		yield* untilChanged("app");

		expect(yield* changeWatch("app")).toBe("woke for a later revision");
	},
);

database.it(
	"the idle wait reads nothing while a batch is running and settles once the busy work finishes",
	[
		running("app", [worker(Checked, { waitsFor: "busy" })], { controller: "test retries" }),
		idleReadsCounted("app", "busy"),
		enqueued(Checked, { id: 1 }, { as: "job 1" }),
		waiting("busy", "job 1 waits at the busy gate"),
		idleWaitStarted("app"),
		enqueued(Checked, { id: 2 }, { as: "job 2" }),
		enqueued(Checked, { id: 3 }, { as: "job 3" }),
	],
	function* ({ idleReads, idleWait, open, storedStates, untilIdleWaitSettles }) {
		expect(yield* idleWait("app")).toBe("still waiting");

		yield* open("busy");
		yield* untilIdleWaitSettles("app");

		yield* outcomes({
			"idle reads": [idleReads(), { "after the busy work went on": expect.any(Number), "while work was busy": 0 }],
			"stored": [storedStates("checked"), { "job 1": "completed", "job 2": "completed", "job 3": "completed" }],
		});
	},
);

const checks: readonly {
	readonly answer: string;
	readonly check: (testing: PgBossTesting) => Effect.Effect<void, unknown>;
	readonly request: string;
}[] = [
	{
		answer: "done",
		check: (testing) => Effect.flatMap(testing.schemaVersion, (version) => testing.checkSchemaVersion(version ?? 0)),
		request: "check the installed schema version",
	},
	{
		answer: "testing checkSchemaVersion failed with Expected pg-boss schema version -1",
		check: (testing) => testing.checkSchemaVersion(-1),
		request: "check for schema version -1",
	},
	{
		answer: "done",
		check: (testing) => testing.checkBatchWindow(Checked, 1000),
		request: "check a batch of one second jobs against the expiry window",
	},
	{
		answer: "testing checkBatchWindow checked failed with Sequential batch work must fit within the queue expiry window",
		check: (testing) => testing.checkBatchWindow(Checked, 30_000),
		request: "check a batch of thirty second jobs against the expiry window",
	},
	{
		answer: "testing expireAfter checked failed with Attempts must be a positive integer",
		check: (testing) => testing.expireAfter(Checked, 0),
		request: "expire after zero attempts",
	},
];

for (const { answer, check, request } of checks) {
	database.it(
		`the testing controller asked to ${request} answers ${answer.startsWith("testing") ? "with a typed testing error" : answer}`,
		[running("app", [Checked], { controller: "test retries" })],
		function* ({ answered, askTesting }) {
			expect(yield* answered()).toBe("nothing asked yet");

			yield* askTesting("app", request, check);

			expect(yield* answered()).toBe(answer);
		},
	);
}
