import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, migrationRuns } from "#test/migrationRuns.ts";

migrationRuns.it(
	"an upgrade applies only the migrations above the ledger and leaves the applied ones unrun",
	[applied(["1_create_orders", "2_add_order_two", "3_append_three"])],
	function* ({ bodiesRun, ledger, migrate, orders, runs }) {
		expect(yield* orders()).toEqual(["two-three"]);

		yield* migrate(["4_append_four", "1_create_orders", "2_add_order_two", "3_append_three"]);

		yield* outcomes({
			"bodies run": [bodiesRun(), ["append_four"]],
			ledger: [
				ledger(),
				[
					[1, "create_orders"],
					[2, "add_order_two"],
					[3, "append_three"],
					[4, "append_four"],
				],
			],
			orders: [orders(), ["two-three-four"]],
			runs: [runs(), [[[4, "append_four"]]]],
		});
	},
);

migrationRuns.it(
	"a rerun of a current ledger applies nothing and repeats no writes",
	[applied(["1_create_orders", "2_add_printer_paper"])],
	function* ({ bodiesRun, migrate, orders, runs }) {
		yield* migrate(["1_create_orders", "2_add_printer_paper"]);

		yield* outcomes({
			"bodies run": [bodiesRun(), []],
			orders: [orders(), ["Printer paper"]],
			runs: [runs(), [[]]],
		});
	},
);

migrationRuns.it(
	"a fresh ledger runs every migration in id order, whatever order the loader lists them in",
	[],
	function* ({ migrate, orders, runs }) {
		yield* migrate(["3_append_three", "1_create_orders", "2_add_order_two"]);

		yield* outcomes({
			orders: [orders(), ["two-three"]],
			runs: [
				runs(),
				[
					[
						[1, "create_orders"],
						[2, "add_order_two"],
						[3, "append_three"],
					],
				],
			],
		});
	},
);

migrationRuns.it(
	"a failed batch rolls back its DDL, data and ledger entries and keeps the migrations committed before it",
	[applied(["1_create_orders"])],
	function* ({ existingTables, ledger, migrate, orders, runs }) {
		yield* migrate(["1_create_orders", "2_create_audit_and_add_printer_paper", "3_add_printer_paper"]);

		yield* outcomes({
			"existing tables": [existingTables(), ["ledger", "orders"]],
			ledger: [ledger(), [[1, "create_orders"]]],
			orders: [orders(), []],
			runs: [runs(), ['failed with a failed migration: Migration "3_add_printer_paper" failed, caused by a unique violation (SQLSTATE 23505)']],
		});
	},
);

migrationRuns.it(
	"a migration missing below the latest applied id fails the run as a bad state naming it, and nothing is applied",
	[applied(["1_create_orders", "3_add_order_three"])],
	function* ({ ledger, migrate, orders, runs }) {
		yield* migrate(["1_create_orders", "2_add_order_two", "3_add_order_three", "4_add_order_four"]);

		yield* outcomes({
			ledger: [
				ledger(),
				[
					[1, "create_orders"],
					[3, "add_order_three"],
				],
			],
			orders: [orders(), ["three"]],
			runs: [runs(), ["failed with a bad migration state: Migrations missing from the ledger at or below latest applied id 3: 2"]],
		});
	},
);

const RACES = [
	{
		given: [],
		ledger: "a fresh ledger",
		migrations: ["1_create_orders", "2_add_printer_paper"] as const,
		winner: [
			[1, "create_orders"],
			[2, "add_printer_paper"],
		],
	},
	{
		given: [applied(["1_create_orders"])],
		ledger: "an existing ledger",
		migrations: ["2_add_printer_paper"] as const,
		winner: [[2, "add_printer_paper"]],
	},
] as const;

for (const race of RACES) {
	migrationRuns.it(
		`concurrent runners on ${race.ledger} wait on the ledger's advisory lock, and only the first applies the migrations`,
		race.given,
		function* ({ ledger, orders, runnersRaceForTheLedger, runs }) {
			yield* runnersRaceForTheLedger(2, race.migrations);

			yield* outcomes({
				ledger: [
					ledger(),
					[
						[1, "create_orders"],
						[2, "add_printer_paper"],
					],
				],
				orders: [orders(), ["Printer paper"]],
				"runs, most applied first": [runs(), [race.winner, []]],
			});
		},
		15_000,
	);
}
