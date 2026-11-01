import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { migrationRuns } from "#test/migrationRuns.ts";

migrationRuns.it(
	"runners sharing a ledger never overlap schema components after the ledger transaction commits",
	[],
	function* ({
		startRunnerPausedInComponent,
		startCompetingRunner,
		competingRunnerWaitsOnLedger,
		componentEvents,
		resumePausedRunner,
		finishCompetingRunner,
		runs,
	}) {
		yield* startRunnerPausedInComponent(["1_create_orders"], { release: "first" });
		yield* startCompetingRunner(["1_create_orders"], { components: ["component observer", "order index"], release: "second" });
		yield* competingRunnerWaitsOnLedger();

		expect(yield* componentEvents()).toEqual(["pause entered"]);

		yield* resumePausedRunner();
		yield* finishCompetingRunner();

		yield* outcomes([
			["component execution order", () => componentEvents(), ["pause entered", "pause resumed", "observer ran"]],
			["completed runs", () => runs(), [[[1, "create_orders"]], []]],
		]);
	},
);

migrationRuns.it(
	"a runner that started earlier cannot replace a release published by a newer invocation",
	[],
	function* ({ startRunnerWithPausedLoader, migrate, resumePausedRunner, recordedRelease, runs }) {
		yield* startRunnerWithPausedLoader(["1_record_first"], { release: "older" });
		yield* migrate(["1_record_first"], { release: "newer" });

		expect(yield* recordedRelease()).toBe("newer");

		yield* resumePausedRunner();

		yield* outcomes([
			["release after the older runner finishes", () => recordedRelease(), "newer"],
			["completed runs", () => runs(), [[[1, "record_first"]], []]],
		]);
	},
);

migrationRuns.it(
	"interrupting a schema component releases the ledger lock and publishes no release",
	[],
	function* ({ startRunnerPausedInComponent, interruptPausedRunner, migrate, recordedRelease, runs }) {
		yield* startRunnerPausedInComponent(["1_record_first"], { release: "interrupted" });
		yield* interruptPausedRunner();

		expect(yield* recordedRelease()).toBe("none");

		yield* migrate(["1_record_first"], { lockTimeout: "100 millis", release: "completed" });

		yield* outcomes([
			["release after the next runner", () => recordedRelease(), "completed"],
			["completed runs", () => runs(), [[]]],
		]);
	},
);

migrationRuns.it(
	"numbered migrations without components or a release still commit using a one-connection pool",
	[],
	function* ({ migrateWithOneConnection, orders, runs }) {
		yield* migrateWithOneConnection(["1_create_orders", "2_add_printer_paper"]);

		yield* outcomes([
			["committed orders", () => orders(), ["Printer paper"]],
			[
				"completed run",
				() => runs(),
				[
					[
						[1, "create_orders"],
						[2, "add_printer_paper"],
					],
				],
			],
		]);
	},
);

migrationRuns.it(
	"a runner with only numbered migrations waits for a runner's schema component on the same ledger",
	[],
	function* ({
		startRunnerPausedInComponent,
		startCompetingRunner,
		competingRunnerWaitsOnLedger,
		orders,
		resumePausedRunner,
		finishCompetingRunner,
		runs,
	}) {
		yield* startRunnerPausedInComponent(["1_create_orders"]);
		yield* startCompetingRunner(["1_create_orders", "2_add_printer_paper"]);
		yield* competingRunnerWaitsOnLedger();

		expect(yield* orders()).toEqual([]);

		yield* resumePausedRunner();
		yield* finishCompetingRunner();

		yield* outcomes([
			["committed orders", () => orders(), ["Printer paper"]],
			["completed runs", () => runs(), [[[1, "create_orders"]], [[2, "add_printer_paper"]]]],
		]);
	},
);
