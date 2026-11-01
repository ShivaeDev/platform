import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedEarlier, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const First = defineQueue({ name: "shutdown-first", schema: Schema.Struct({}) });
const Second = defineQueue({ name: "shutdown-second", schema: Schema.Struct({}) });

for (const client of ["its own", "a shared"] as const) {
	for (const timeout of [1000, undefined]) {
		const budget = timeout ?? 30_000;
		const clientCacheKey = Symbol(`bounded shutdown on ${client} client`);
		database.it(
			`a runtime on ${client} client drains its workers together, interrupts them at ${timeout === undefined ? "the default 30s timeout" : "stop.timeout"} and reports each timeout`,
			[
				enqueuedEarlier(First, {}, { as: "first job" }),
				enqueuedEarlier(Second, {}, { as: "second job" }),
				...(client === "a shared" ? [running("producer", [First, Second], { clientCacheKey })] : []),
				running("app", [worker(First, { waitsFor: "first" }), worker(Second, { waitsFor: "second" })], {
					clientCacheKey,
					finalizesInParallel: true,
					...(timeout === undefined ? {} : { stop: { timeout } }),
				}),
				waiting("first", "the first handler is running"),
				waiting("second", "the second handler is running"),
			],
			function* ({ drainTimePasses, interruptions, logged, shutdown, stopInBackground, untilStopped, untilWorkersDrain }) {
				yield* stopInBackground("app");
				yield* untilWorkersDrain(2);
				yield* drainTimePasses(budget - 1);

				yield* outcomes([
					["shutdown before timeout", () => shutdown("app"), "still stopping"],
					["first handler before timeout", () => interruptions(First), []],
					["second handler before timeout", () => interruptions(Second), []],
					["worker reports before timeout", () => logged("app"), []],
				]);

				yield* drainTimePasses(1);
				yield* untilStopped("app");

				yield* outcomes([
					["shutdown at timeout", () => shutdown("app"), "stopped"],
					["first handler", () => interruptions(First), ["first job before its deadline"]],
					["second handler", () => interruptions(Second), ["second job before its deadline"]],
					[
						"worker reports",
						() => logged("app"),
						expect.arrayContaining([
							{ level: "Warn", message: `pg-boss worker drain timed out for queue shutdown-first after ${budget}ms; interrupting in-flight work` },
							{ level: "Warn", message: `pg-boss worker drain timed out for queue shutdown-second after ${budget}ms; interrupting in-flight work` },
						]),
					],
				]);
			},
			{ clock: "test" },
		);
	}
}

database.it(
	"a non-graceful shutdown interrupts its running handler without waiting or reporting a drain timeout",
	[
		enqueuedEarlier(First, {}, { as: "first job" }),
		running("app", [worker(First, { waitsFor: "first" })], { stop: { graceful: false } }),
		waiting("first", "the first handler is running"),
	],
	function* ({ interruptions, logged, stop }) {
		yield* stop("app");

		yield* outcomes([
			["handler", () => interruptions(First), ["first job before its deadline"]],
			["worker reports", () => logged("app"), []],
		]);
	},
	{ clock: "test" },
);
