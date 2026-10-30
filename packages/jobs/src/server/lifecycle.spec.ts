import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { clientStartFails, clientStopFails, queueCreationFails, running, runtime } from "#test/runtime/kit.ts";
import { worker } from "#test/workers.ts";

const Broken = defineQueue({ name: "broken", schema: Schema.Struct({}) });

runtime.it(
	"two runtimes without a client key each construct and start their own client",
	[running("first")],
	function* ({ clientCalls, clientsConstructed, start }) {
		yield* start("second", []);

		yield* outcomes({
			"client calls": [clientCalls(), ["start", "start"]],
			"clients constructed": [clientsConstructed(), 2],
		});
	},
);

runtime.it(
	"a runtime whose queue registration fails stops the client it started",
	[queueCreationFails("pg-boss cannot create queues", new Error("queue unavailable"))],
	function* ({ clientCalls, start, startup }) {
		yield* start("app", [worker(Broken, "succeeds")]);

		yield* outcomes({
			"app runtime": [startup("app"), "register broken failed with queue unavailable"],
			"client calls": [clientCalls(), ["start", "stop"]],
		});
	},
);

runtime.it(
	"a runtime whose client fails to start still stops that client",
	[clientStartFails("start unavailable")],
	function* ({ clientCalls, start, startup }) {
		yield* start("app", []);

		yield* outcomes({
			"app runtime": [startup("app"), "start failed with start unavailable"],
			"client calls": [clientCalls(), ["start", "stop"]],
		});
	},
);

runtime.it(
	"a failed start keeps its start error when stopping the client fails too",
	[clientStartFails("external client initialization failed"), clientStopFails("external client teardown failed")],
	function* ({ clientCalls, start, startup }) {
		yield* start("app", []);

		yield* outcomes({
			"app runtime": [startup("app"), "start failed with external client initialization failed"],
			"client calls": [clientCalls(), ["start", "stop"]],
		});
	},
);

runtime.it(
	"a failing client stop is logged as a stop error and the runtime still stops",
	[clientStopFails("external client teardown failed"), running("app")],
	function* ({ logged, stop }) {
		yield* stop("app");

		expect(yield* logged()).toEqual([{ level: "Error", message: "stop failed with external client teardown failed" }]);
	},
);

const Sleepy = defineQueue({ name: "sleepy", schema: Schema.Struct({}) });

runtime.it(
	"a handler's sleep runs on the worker runtime's clock",
	[running("app", [worker(Sleepy, { sleeps: 100 })])],
	function* ({ clockPasses, deliveryFinishes, settlements, startsDelivering }) {
		yield* startsDelivering("sleepy", { id: "job-1" });
		yield* clockPasses(99);
		expect(yield* settlements()).toEqual([]);

		yield* clockPasses(1);
		yield* deliveryFinishes();

		expect(yield* settlements()).toEqual(["job-1 completed"]);
	},
	{ clock: "test" },
);

runtime.it(
	"stopping the runtime interrupts a running handler and settles nothing",
	[running("app", [worker(Sleepy, "hangs")])],
	function* ({ deliveryFinishes, interrupted, settlements, startsDelivering, stop }) {
		yield* startsDelivering("sleepy", { id: "job-1" });

		yield* stop("app");
		yield* deliveryFinishes();

		yield* outcomes({
			"interrupted": [interrupted(), ["job-1"]],
			"settlements": [settlements(), []],
		});
	},
);
