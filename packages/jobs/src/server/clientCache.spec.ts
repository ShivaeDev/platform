import type { ConstructorOptions } from "pg-boss";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineSchedule } from "#definition.ts";
import { clientStartPending, clientStopFails, freshClientEachTime, running, runtime, sharedClientKey, stopped } from "#test/runtime/kit.ts";
import { scheduled } from "#test/workers.ts";

runtime.it(
	"a second runtime under the same client key and settings reuses the started client",
	[sharedClientKey(), running("first")],
	function* ({ clientCalls, clientsConstructed, start, startup }) {
		yield* start("second", []);

		yield* outcomes({
			"client calls": [clientCalls(), ["start"]],
			"clients constructed": [clientsConstructed(), 1],
			"second runtime": [startup("second"), "started"],
		});
	},
);

runtime.it(
	"the shared client keeps running while one of its runtimes stops and stops with the last",
	[sharedClientKey(), running("first"), running("second")],
	function* ({ clientCalls, stop }) {
		yield* stop("first");
		expect(yield* clientCalls()).toEqual(["start"]);

		yield* stop("second");

		expect(yield* clientCalls()).toEqual(["start", "stop"]);
	},
);

const conflicts: readonly { name: string; first: ConstructorOptions; second: ConstructorOptions; options: string }[] = [
	{
		first: { connectionString: "postgresql://first" },
		name: "its connection string differs",
		options: "connectionString",
		second: { connectionString: "postgresql://second" },
	},
	{ first: { schema: "first" }, name: "its schema differs", options: "schema", second: { schema: "second" } },
	{ first: { max: 2 }, name: "its pool size differs", options: "max", second: { max: 3 } },
	{ first: {}, name: "it adds a setting", options: "schedule", second: { schedule: false } },
	{ first: { schedule: false }, name: "it leaves out a setting", options: "schedule", second: {} },
	{ first: { ssl: { rejectUnauthorized: true } }, name: "a nested setting differs", options: "ssl", second: { ssl: { rejectUnauthorized: false } } },
	{ first: { max: 2, schema: "first" }, name: "several settings differ", options: "max, schema", second: { max: 3, schema: "second" } },
];

for (const conflict of conflicts) {
	runtime.it(
		`a second runtime under the same client key fails when ${conflict.name}, and the started client keeps running`,
		[sharedClientKey(), running("first", [], conflict.first)],
		function* ({ clientCalls, clientsConstructed, start, startup }) {
			yield* start("second", [], conflict.second);

			yield* outcomes({
				"client calls": [clientCalls(), ["start"]],
				"clients constructed": [clientsConstructed(), 1],
				"second runtime": [startup("second"), `Shared pg-boss client Symbol(shared) has different constructor settings: ${conflict.options}`],
			});
		},
	);
}

runtime.it(
	"equal nested settings do not conflict on a shared client key",
	[sharedClientKey(), running("first", [], { ssl: { rejectUnauthorized: true } })],
	function* ({ start, startup }) {
		yield* start("second", [], { ssl: { rejectUnauthorized: true } });

		expect(yield* startup("second")).toBe("started");
	},
);

runtime.it(
	"two runtimes waiting on the same client start both fail with its start error, and the client is stopped once",
	[sharedClientKey(), clientStartPending],
	function* ({ clientCalls, failClientStart, startTogether, startup }) {
		yield* startTogether("first", "second");
		expect(yield* clientCalls()).toEqual(["start"]);

		yield* failClientStart("external client initialization failed");

		yield* outcomes({
			"client calls": [clientCalls(), ["start", "stop"]],
			"first runtime": [startup("first"), "start failed with external client initialization failed"],
			"second runtime": [startup("second"), "start failed with external client initialization failed"],
		});
	},
);

runtime.it(
	"after the shared client's start fails, the next runtime under the key constructs a fresh client",
	[sharedClientKey(), clientStartPending, freshClientEachTime],
	function* ({ clientsConstructed, failClientStart, start, startTogether, startup }) {
		yield* startTogether("first");
		yield* failClientStart("external client initialization failed");

		yield* start("retry", []);

		yield* outcomes({
			"clients constructed": [clientsConstructed(), 2],
			"retry runtime": [startup("retry"), "started"],
		});
	},
);

runtime.it(
	"after the shared client's stop fails, the next runtime under the key constructs a fresh client",
	[sharedClientKey(), clientStopFails("external client teardown failed"), freshClientEachTime, stopped("first")],
	function* ({ clientsConstructed, start, startup }) {
		yield* start("second", []);

		yield* outcomes({
			"clients constructed": [clientsConstructed(), 2],
			"second runtime": [startup("second"), "started"],
		});
	},
);

const Cleanup = defineSchedule({ cron: "17 3 * * *", name: "cached-cleanup" });

runtime.it(
	"a second runtime under the same client key stops the first runtime's schedule worker before registering its own",
	[sharedClientKey(), running("first", [scheduled(Cleanup, "succeeds")])],
	function* ({ start, workerCalls }) {
		expect(yield* workerCalls()).toEqual(["work cached-cleanup"]);

		yield* start("second", [scheduled(Cleanup, "succeeds")]);

		expect(yield* workerCalls()).toEqual(["work cached-cleanup", "stop working cached-cleanup", "work cached-cleanup"]);
	},
);
