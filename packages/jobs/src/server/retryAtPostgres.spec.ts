import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { deferred, enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Deferring = defineQueue({
	name: "deferring",
	queue: { policy: "stately", retryLimit: 0 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const deferring = running("app", [worker(Deferring, { defers: "Provider quota", until: "tomorrow" }, "succeeds")], { reportsErrors: true });

const RarelyPolled = defineQueue({
	name: "rarely-polled",
	queue: { notify: true, policy: "stately", retryLimit: 0 },
	schema: Schema.Struct({ id: Schema.NumberFromString }),
	worker: { notifyPollingIntervalSeconds: 600, pollingIntervalSeconds: 600 },
});

const deferredOnce = [
	running("app", [worker(RarelyPolled, { defers: "Provider quota", until: "tomorrow" }, "succeeds")], { useListenNotify: true }),
	enqueued(RarelyPolled, { id: 42 }, { as: "job 42", singletonKey: "account-42" }),
	deferred(RarelyPolled, 1),
];

database.it(
	"a deferred job waits to run again without spending a retry, reporting an error or being dead-lettered",
	[deferring],
	function* ({ deadLettered, deferrals, enqueue, job, reported, untilDeferred }) {
		yield* enqueue("app", Deferring, { id: 42 }, { as: "job 42", singletonKey: "account-42" });
		yield* untilDeferred("app", Deferring, 1);

		yield* outcomes({
			"dead-lettered": [deadLettered(Deferring), []],
			"deferrals": [deferrals("app", Deferring), [{ at: "the time the worker asked for", reason: "Provider quota" }]],
			"job 42": [job("job 42"), expect.objectContaining({ retryCount: 0, singletonKey: "account-42", state: "retry" })],
			"reported errors": [reported(), []],
		});
	},
);

database.it(
	"a deferred attempt ends its job span successfully with a job.deferred event",
	[deferring],
	function* ({ enqueue, spans, untilDeferred }) {
		yield* enqueue("app", Deferring, { id: 42 }, { as: "job 42" });
		yield* untilDeferred("app", Deferring, 1);

		expect((yield* spans()).map(({ events, name, outcome }) => ({ events, name, outcome }))).toEqual([
			{ events: [expect.stringMatching(/^job\.deferred \{"at":"[^"]+","reason":"Provider quota"\}$/u)], name: "deferring", outcome: "succeeded" },
		]);
	},
);

database.it(
	"running a deferred job now runs it again under its own id without spending a retry or waiting for the worker's next poll",
	deferredOnce,
	function* ({ attempts, deferrals, job, runDeferredNow, untilJob }) {
		expect(yield* attempts(RarelyPolled)).toEqual(["job 42"]);

		yield* runDeferredNow("app", RarelyPolled);
		yield* untilJob("job 42", "completed");

		yield* outcomes({
			"attempts": [attempts(RarelyPolled), ["job 42", "job 42"]],
			"deferrals": [deferrals("app", RarelyPolled), []],
			"job 42": [job("job 42"), expect.objectContaining({ retryCount: 0, singletonKey: "account-42" })],
		});
	},
);

const Due = defineQueue({
	name: "due",
	queue: { notify: true },
	schema: Schema.Struct({}),
	worker: { notifyPollingIntervalSeconds: 0.5, pollingIntervalSeconds: 0.5 },
});

database.it(
	"a job deferred for a moment runs again no earlier than the time it asked for",
	[running("app", [worker(Due, { defers: "Slow down", until: { afterMillis: 1500 } }, "succeeds")], { useListenNotify: true })],
	function* ({ deferralsKept, enqueue, job, untilJob }) {
		yield* enqueue("app", Due, {}, { as: "due job" });
		yield* untilJob("due job", "completed");

		yield* outcomes({
			"deferrals": [deferralsKept("due job"), ["ran again at or after the deferral time"]],
			"due job": [job("due job"), expect.objectContaining({ retryCount: 0 })],
		});
	},
);
