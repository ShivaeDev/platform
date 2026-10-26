import { Cause, Effect, Exit } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { columnDrift, upgrade } from "#test/upgradeStory.ts";

upgrade.it(
	"upgrades committed old migrations and returns exact live PostgreSQL column types",
	[],
	function* ({ upgradeWithObserver, checkModelColumns, readItemNames, readUpgradeLedger, readUpgradeCounts }) {
		const observed = yield* upgradeWithObserver();
		expect(observed.committed).toEqual([{ "old_name": "kept" }]);
		expect(observed.columns).toEqual([
			{ name: "id", type: "integer" },
			{ name: "name", type: "text" },
			{ name: "price", type: "numeric(10,2)" },
		]);
		yield* checkModelColumns(observed.columns);
		expect(yield* readItemNames()).toEqual([{ name: "kept" }]);
		expect(yield* readUpgradeLedger()).toEqual([{ "migration_id": 1 }, { "migration_id": 2 }, { "migration_id": 3 }]);
		expect(yield* readUpgradeCounts()).toMatchObject({ loads: 1 });
	},
);
upgrade.it("rejects an unknown migration id, a populated ledger and a wrapping transaction", [], function* ({ upgradeTo, upgradeInTransaction }) {
	expect((yield* upgradeTo(2).pipe(Effect.flip)).message).toBe("Migration 2 is not in the loader.");
	expect((yield* upgradeInTransaction().pipe(Effect.flip)).message).toContain("outside a wrapping transaction");
	yield* upgradeTo(1);
	expect((yield* upgradeTo(1).pipe(Effect.flip)).message).toContain("empty migration ledger");
});
upgrade.it(
	"rejects a populated mixed-case ledger before loading or running migrations",
	[],
	function* ({ prepareMixedCaseLedger, upgradeMixedCaseLedger, readUpgradeLedger, readItemNames, readUpgradeCounts }) {
		yield* prepareMixedCaseLedger();
		expect(yield* upgradeMixedCaseLedger().pipe(Effect.flip)).toMatchObject({
			_tag: "MigrationError",
			kind: "BadState",
			message: "Migration upgrade checks require an empty migration ledger.",
		});
		expect(yield* readUpgradeLedger("UpgradeMigrations")).toEqual([{ "migration_id": 3 }]);
		expect(yield* readItemNames()).toEqual([{ name: "kept" }]);
		expect(yield* readUpgradeCounts()).toEqual({ loads: 0, runs: 0 });
	},
);
for (const [name, statement, problem] of [
	["missing", "alter table items drop column price", "Missing column: price"],
	["extra", "alter table items add column surprise text", "Extra column: surprise"],
	["wrongly typed", "alter table items alter column name type varchar(30)", "Wrong type for name: expected text, received character varying(30)"],
] as const) {
	upgrade.it(
		`the model assertion fails for a ${name} PostgreSQL column`,
		[columnDrift(statement, problem)],
		function* ({ upgradeWithDrift, checkModelColumns }) {
			const columns = yield* upgradeWithDrift();
			expect((yield* checkModelColumns(columns).pipe(Effect.flip)).problems).toEqual([problem]);
		},
	);
}
upgrade.it(
	"retains loader failures and migration defects while preserving the committed old schema",
	[],
	function* ({ upgradeWithFailedLoader, upgradeWithBrokenMigration, readOldNames, readUpgradeLedger }) {
		const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader failed" });
		expect(yield* upgradeWithFailedLoader(failure).pipe(Effect.flip)).toBe(failure);
		const exit = yield* upgradeWithBrokenMigration().pipe(Effect.exit);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.pretty(exit.cause)).toContain("MigrationError");
		}
		expect(yield* readOldNames()).toEqual([{ "old_name": "kept" }]);
		expect(yield* readUpgradeLedger()).toEqual([{ "migration_id": 1 }]);
	},
);
