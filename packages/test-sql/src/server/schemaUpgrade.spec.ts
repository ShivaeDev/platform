import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { columnDrift, populatedMixedCaseLedger, upgrade } from "#test/upgradeStory.ts";

upgrade.it(
	"an upgrade commits the migrations through upTo, so another connection sees their rows while a later migration runs",
	[],
	function* ({ rowsSeenByLaterMigration, upgradeWatchedByLaterMigration }) {
		yield* upgradeWatchedByLaterMigration();

		expect(yield* rowsSeenByLaterMigration()).toEqual(["kept"]);
	},
);

upgrade.it("an upgrade returns the table's live column names and exact types, without its dropped column", [], function* ({ columns, runUpgrade }) {
	yield* runUpgrade();

	expect(yield* columns()).toEqual([
		{ name: "id", type: "integer" },
		{ name: "name", type: "text" },
		{ name: "price", type: "numeric(10,2)" },
	]);
});

upgrade.it("the columns of an upgrade to the current schema match the Item model", [], function* ({ modelCheck, runUpgrade }) {
	yield* runUpgrade();

	expect(yield* modelCheck()).toBe("matches the model");
});

upgrade.it("an upgrade resolves the application's loader once", [], function* ({ loaderResolutions, runUpgrade }) {
	expect(yield* loaderResolutions()).toBe("never");

	yield* runUpgrade();

	expect(yield* loaderResolutions()).toBe("once");
});

for (const [kind, statement, problem] of [
	["a missing", "alter table items drop column price", "Missing column: price"],
	["an extra", "alter table items add column surprise text", "Extra column: surprise"],
	["a wrongly typed", "alter table items alter column name type varchar(30)", "Wrong type for name: expected text, received character varying(30)"],
] as const) {
	upgrade.it(
		`after an upgrade that leaves ${kind} column, the model check reports it`,
		[columnDrift(statement)],
		function* ({ modelCheck, runUpgrade }) {
			yield* runUpgrade();

			expect(yield* modelCheck()).toBe(`mismatch: ${problem}`);
		},
	);
}

upgrade.it("an upgrade from a migration id the loader lacks fails naming that id", [], function* ({ upgradeFrom, upgradeOutcome }) {
	yield* upgradeFrom(2);

	expect(yield* upgradeOutcome()).toBe("failed with BadState: Migration 2 is not in the loader.");
});

upgrade.it(
	"an upgrade inside a rollback test fails asking to run outside a wrapping transaction",
	[],
	function* ({ upgradeInRollbackTest, upgradeOutcome }) {
		yield* upgradeInRollbackTest();

		expect(yield* upgradeOutcome()).toBe("failed with BadState: Migration upgrade checks must run outside a wrapping transaction.");
	},
);

upgrade.it(
	"an upgrade over a populated mixed-case ledger fails asking for an empty ledger, before it resolves the loader",
	[populatedMixedCaseLedger],
	function* ({ loaderResolutions, runUpgrade, upgradeOutcome }) {
		yield* runUpgrade();

		yield* outcomes({
			"loader resolutions": [loaderResolutions(), "never"],
			"the upgrade": [upgradeOutcome(), "failed with BadState: Migration upgrade checks require an empty migration ledger."],
		});
	},
);

upgrade.it("an upgrade fails with the loader's own failure", [], function* ({ upgradeOutcome, upgradeWithFailingLoader }) {
	yield* upgradeWithFailingLoader();

	expect(yield* upgradeOutcome()).toBe("failed with ImportError: loader failed");
});

upgrade.it(
	"when a later migration fails, the upgrade fails and keeps the migrations through upTo committed",
	[],
	function* ({ appliedMigrations, itemNamesInOldColumn, upgradeOutcome, upgradeWithFailingLaterMigration }) {
		yield* upgradeWithFailingLaterMigration();

		yield* outcomes({
			"applied migrations": [appliedMigrations(), [1]],
			"item names in the old column": [itemNamesInOldColumn(), ["kept"]],
			"the upgrade": [upgradeOutcome(), 'failed with Failed: Migration "4_broken" failed'],
		});
	},
);
