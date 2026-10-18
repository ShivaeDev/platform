import { columnDrift, upgrade } from "#test/upgradeStory.ts";

upgrade.it("upgrades committed old migrations and returns exact live PostgreSQL column types", [], function* ({ upgradeCommitsOldSchema }) {
	yield* upgradeCommitsOldSchema();
});

upgrade.it("rejects an unknown migration id, a populated ledger and a wrapping transaction", [], function* ({ invalidUpgradeStatesAreRejected }) {
	yield* invalidUpgradeStatesAreRejected();
});

upgrade.it("rejects a populated mixed-case ledger before loading or running migrations", [], function* ({ populatedMixedCaseLedgerIsUntouched }) {
	yield* populatedMixedCaseLedgerIsUntouched();
});

for (const [name, statement, problem] of [
	["missing", "alter table items drop column price", "Missing column: price"],
	["extra", "alter table items add column surprise text", "Extra column: surprise"],
	["wrongly typed", "alter table items alter column name type varchar(30)", "Wrong type for name: expected text, received character varying(30)"],
] as const) {
	upgrade.it(`the model assertion fails for a ${name} PostgreSQL column`, [columnDrift(statement, problem)], function* ({ driftIsReported }) {
		yield* driftIsReported();
	});
}

upgrade.it(
	"retains loader failures and migration defects while preserving the committed old schema",
	[],
	function* ({ upgradeFailuresKeepOldSchema }) {
		yield* upgradeFailuresKeepOldSchema();
	},
);
