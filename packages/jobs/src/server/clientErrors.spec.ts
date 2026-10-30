import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue, defineSchedule } from "#definition.ts";
import {
	clientStartFails,
	clientStopFails,
	connectionTerminated,
	connectionTerminatedDuring,
	errorsReported,
	failedToStart,
	running,
	runtime,
	stopped,
} from "#test/runtime/kit.ts";
import { scheduled, worker } from "#test/workers.ts";

const terminationLogged = {
	level: "Debug",
	message: { event: "pg_boss_error", message: "terminating connection due to administrator command" },
};

runtime.it(
	"a connection termination while the client starts is logged at debug level",
	[connectionTerminatedDuring("startup")],
	function* ({ logged, start }) {
		yield* start("app", []);

		expect(yield* logged()).toEqual([terminationLogged]);
	},
);

runtime.it(
	"a connection termination while the client stops is logged at debug level",
	[connectionTerminatedDuring("shutdown"), running("app")],
	function* ({ logged, stop }) {
		yield* stop("app");

		expect(yield* logged()).toEqual([terminationLogged]);
	},
);

runtime.it(
	"a connection termination during a start that fails is logged at debug level beside the start failure",
	[connectionTerminatedDuring("startup"), clientStartFails("terminating connection due to administrator command")],
	function* ({ logged, start, startup }) {
		yield* start("app", []);

		yield* outcomes({
			"app runtime": [startup("app"), "start failed with terminating connection due to administrator command"],
			"logs": [logged(), [terminationLogged]],
		});
	},
);

const stopFailureLogged = { level: "Error", message: "stop failed with connection lost" };

const endings = [
	{ given: [stopped("app")], how: "stopped", logs: [terminationLogged] },
	{
		given: [clientStopFails("connection lost"), stopped("app")],
		how: "stopped and its client's stop failed",
		logs: [stopFailureLogged, terminationLogged],
	},
	{ given: [stopped("app", [], { stop: { close: false } })], how: "stopped and kept its pool open", logs: [terminationLogged] },
	{ given: [clientStartFails("connection refused"), failedToStart("app")], how: "failed to start", logs: [terminationLogged] },
	{
		given: [clientStartFails("connection refused"), clientStopFails("connection lost"), failedToStart("app")],
		how: "failed to start and its cleanup failed",
		logs: [terminationLogged],
	},
];

for (const ending of endings) {
	runtime.it(
		`after the runtime ${ending.how}, its one remaining client listener logs a late connection termination at debug level`,
		ending.given,
		function* ({ emitClientError, errorListeners, logged }) {
			yield* emitClientError(connectionTerminated());

			yield* outcomes({
				"client error listeners": [errorListeners(), 1],
				"logs": [logged(), ending.logs],
			});
		},
	);
}

runtime.it("after the runtime stops, any other client error is logged at error level", [stopped("app")], function* ({ emitClientError, logged }) {
	yield* emitClientError(new Error("pg-boss background worker stopped unexpectedly"));

	expect(yield* logged()).toEqual([
		{ level: "Error", message: { event: "pg_boss_error", message: "pg-boss background worker stopped unexpectedly" } },
	]);
});

runtime.it(
	"while the runtime runs, a client error reaches the application's onError with the services the runtime started with",
	[errorsReported, running("app")],
	function* ({ applicationLog, emitClientError }) {
		yield* emitClientError(new Error("pg-boss background worker stopped unexpectedly"));

		expect(yield* applicationLog()).toEqual(["onError: pg-boss background worker stopped unexpectedly"]);
	},
);

runtime.it(
	"after the runtime stops, a client error is logged instead of reaching the application's onError",
	[errorsReported, stopped("app")],
	function* ({ applicationLog, emitClientError, logged }) {
		yield* emitClientError(connectionTerminated());

		yield* outcomes({
			"application log": [applicationLog(), []],
			"logs": [logged(), [terminationLogged]],
		});
	},
);

const Duplicate = defineQueue({ name: "duplicate", schema: Schema.Struct({}) });
const DuplicateSchedule = defineSchedule({ cron: "17 3 * * *", name: "duplicate" });

runtime.it(
	"after the runtime fails to register its jobs, a client error no longer reaches the application's onError",
	[errorsReported, failedToStart("app", [worker(Duplicate, "succeeds"), scheduled(DuplicateSchedule, "succeeds")])],
	function* ({ applicationLog, emitClientError }) {
		yield* emitClientError(connectionTerminated());

		expect(yield* applicationLog()).toEqual([]);
	},
);
