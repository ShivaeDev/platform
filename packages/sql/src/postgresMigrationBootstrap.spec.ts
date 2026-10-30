import { Duration } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { migrationRuns } from "#test/migrationRuns.ts";

migrationRuns.it(
	"a runner that cannot take the ledger lock within its lockTimeout fails with a lock timeout while the holder finishes",
	[],
	function* ({ migrate, orders, resumePausedRunner, runs, startPausedRunner }) {
		yield* startPausedRunner(["1_create_orders", "2_pause_then_add_printer_paper"]);

		yield* migrate(["1_create_orders", "2_pause_then_add_printer_paper"], { lockTimeout: "100 millis" });
		yield* resumePausedRunner();

		yield* outcomes({
			orders: [orders(), ["Printer paper"]],
			runs: [
				runs(),
				[
					"failed with a lock timeout (SQLSTATE 55P03)",
					[
						[1, "create_orders"],
						[2, "pause_then_add_printer_paper"],
					],
				],
			],
		});
	},
	15_000,
);

migrationRuns.it("a failed first batch also rolls back the ledger it bootstrapped", [], function* ({ existingTables, migrate }) {
	yield* migrate(["1_create_orders", "2_add_printer_paper_twice"]);

	expect(yield* existingTables()).toEqual([]);
});

const LOCK_TIMEOUTS = [
	{ lockTimeout: Duration.seconds(5), name: "5 seconds", setting: "5s" },
	{ lockTimeout: Duration.infinity, name: "Duration.infinity", setting: "0" },
] as const;

for (const { lockTimeout, name, setting } of LOCK_TIMEOUTS) {
	migrationRuns.it(`a lockTimeout of ${name} sets the batch's PostgreSQL lock_timeout to ${setting}`, [], function* ({ lockTimeoutsSeen, migrate }) {
		yield* migrate(["1_read_lock_timeout"], { lockTimeout });

		expect(yield* lockTimeoutsSeen()).toEqual([setting]);
	});
}
