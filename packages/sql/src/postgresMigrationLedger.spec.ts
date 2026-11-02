import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, migrationRuns } from "#test/migrationRuns.ts";

const original = ["1_create_orders", "2_add_order_two", "3_add_order_three"] as const;

for (const migrations of [
	["1_create_orders", "2_add_printer_paper", "3_add_order_three", "4_add_order_four"],
	["1_create_orders", "2_add_printer_paper"],
] as const) {
	for (const action of ["migrate", "assertReady"] as const) {
		migrationRuns.it(
			`${action} rejects a reused id below the latest ledger entry with ${migrations.length === 4 ? "new work pending" : "an older loader"}`,
			[applied(original)],
			function* (verbs) {
				const result = yield* verbs[action](migrations);

				expect(result).toBe(
					action === "migrate"
						? 'failed with a bad migration state: Migration 2 is recorded as "add_order_two" but loaded as "add_printer_paper"'
						: `failed with a bad migration state: Database migrations are not current: migration 2 (add_printer_paper)${migrations.length === 4 ? "; migration 4 (add_order_four)" : ""}. Run the deployment migration command.`,
				);
				yield* outcomes([
					["bodies run", () => verbs.bodiesRun(), []],
					[
						"ledger",
						() => verbs.ledger(),
						[
							[1, "create_orders"],
							[2, "add_order_two"],
							[3, "add_order_three"],
						],
					],
					["orders", () => verbs.orders(), ["three", "two"]],
				]);
			},
		);
	}
}

migrationRuns.it(
	"a reused latest id rejects new migrations, schema components and release publication before they run",
	[applied(["1_create_orders", "2_add_order_two"], { release: "first" })],
	function* ({ bodiesRun, componentEvents, ledger, migrate, orders, recordedRelease }) {
		const result = yield* migrate(["1_create_orders", "2_add_printer_paper", "3_add_order_three"], {
			components: ["component observer"],
			release: "second",
		});

		expect(result).toBe('failed with a bad migration state: Migration 2 is recorded as "add_order_two" but loaded as "add_printer_paper"');
		yield* outcomes([
			["bodies run", () => bodiesRun(), []],
			["component events", () => componentEvents(), []],
			[
				"ledger",
				() => ledger(),
				[
					[1, "create_orders"],
					[2, "add_order_two"],
				],
			],
			["orders", () => orders(), ["two"]],
			["recorded release", () => recordedRelease(), "first"],
		]);
	},
);

migrationRuns.it(
	"an older loader with matching names migrates without repeating work and remains ready",
	[applied(original)],
	function* ({ assertReady, bodiesRun, migrate }) {
		const result = yield* migrate(["1_create_orders", "2_add_order_two"]);

		expect(result).toEqual([]);
		yield* outcomes([
			["bodies run", () => bodiesRun(), []],
			["readiness", () => assertReady(["1_create_orders", "2_add_order_two"]), "ready"],
		]);
	},
);
