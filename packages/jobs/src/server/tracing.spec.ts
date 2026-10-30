import { Effect, Schema, Tracer } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue, defineSchedule } from "#definition.ts";
import { running, runtime } from "#test/runtime/kit.ts";
import { scheduled, worker } from "#test/workers.ts";

const Nightly = defineSchedule({ cron: "17 3 * * *", name: "nightly" });
const Orders = defineQueue({ name: "orders", schema: Schema.Struct({ id: Schema.NumberFromString }) });
const sender = { sampled: true, spanId: "0123456789abcdef", traceId: "0123456789abcdef0123456789abcdef" };

runtime.it(
	"a scheduled run's Effect.fn step runs under the run's root job span",
	[running("app", [scheduled(Nightly, { next: "succeeds", step: "Nightly.step" })])],
	function* ({ deliver, spans }) {
		yield* deliver("nightly", [{ data: null, id: "nightly-run" }]);

		expect((yield* spans()).map(({ name, parent, trace }) => ({ name, parent, trace }))).toEqual([
			{ name: "nightly", parent: "no parent", trace: "trace 1" },
			{ name: "Nightly.step", parent: "nightly", trace: "trace 1" },
		]);
	},
);

runtime.it(
	"a failed scheduled run fails its job and ends its job span with the failure",
	[running("app", [scheduled(Nightly, { fails: "Scheduled failure" })])],
	function* ({ deliver, settlements, spans }) {
		yield* deliver("nightly", [{ data: null, id: "nightly-run" }]);

		yield* outcomes({
			"job span": [
				spans().pipe(Effect.map((all) => all.map(({ name, outcome }) => ({ name, outcome })))),
				[{ name: "nightly", outcome: "failed with Scheduled failure" }],
			],
			"settlements": [settlements(), ["nightly-run failed with Scheduled failure"]],
		});
	},
);

runtime.it("enqueueing under a span wraps the encoded payload with that span's ids", [running("app", [Orders])], function* ({ ask, sent }) {
	yield* ask("app", "enqueue order 7 under the sender's span", (jobs) =>
		jobs.enqueue(Orders, { id: 7 }).pipe(Effect.withParentSpan(Tracer.externalSpan(sender))),
	);

	expect(yield* sent()).toEqual([
		{ data: { _tag: "@shivaedev/jobs/TracedPayload", payload: { id: "7" }, span: sender }, name: "orders", options: undefined },
	]);
});

runtime.it(
	"a delivered traced payload reaches the handler unwrapped, and its root job span links to the sender's span",
	[running("app", [worker(Orders, "succeeds")])],
	function* ({ deliver, handled, settlements, spans }) {
		yield* deliver("orders", [{ data: { _tag: "@shivaedev/jobs/TracedPayload", payload: { id: "7" }, span: sender }, id: "job-7" }]);

		yield* outcomes({
			"handled payloads": [handled("orders"), [{ id: 7 }]],
			"job span": [
				spans().pipe(Effect.map((all) => all.map(({ links, name, parent }) => ({ links, name, parent })))),
				[{ links: [`external span ${sender.spanId} in trace ${sender.traceId}`], name: "orders", parent: "no parent" }],
			],
			"settlements": [settlements(), ["job-7 completed"]],
		});
	},
);

runtime.it(
	"a payload that fails to decode ends its job span with the decode failure",
	[running("app", [worker(defineQueue({ name: "typed", schema: Schema.Struct({ id: Schema.Number }) }), "succeeds")])],
	function* ({ deliver, spans }) {
		yield* deliver("typed", [{ data: { id: "invalid" }, id: "job-1" }]);

		expect((yield* spans()).map(({ name, outcome }) => ({ name, outcome }))).toEqual([
			{ name: "typed", outcome: 'failed with decode typed payload failed with Expected number\n  at ["id"]' },
		]);
	},
);

runtime.it(
	"a job enqueued from inside a scheduled run links its own job span to the run's job span",
	[running("app", [scheduled(Nightly, { enqueues: (jobs) => jobs.enqueue(Orders, { id: 1 }) }), worker(Orders, "succeeds")])],
	function* ({ deliver, sent, spans }) {
		yield* deliver("nightly", [{ data: null, id: "nightly-run" }]);
		const [followUp] = yield* sent();

		yield* deliver("orders", [{ data: followUp?.data, id: "follow-up" }]);

		expect((yield* spans()).map(({ links, name }) => ({ links, name }))).toEqual([
			{ links: [], name: "nightly" },
			{ links: ["nightly"], name: "orders" },
		]);
	},
);
