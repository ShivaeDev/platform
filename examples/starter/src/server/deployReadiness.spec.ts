import { expect } from "vitest";
import { conflictingNotesTable, deployment } from "#test-support/deployment.ts";

deployment.it(
	"applies migrations without an auth secret and preserves saved notes and the ledger on rerun",
	[],
	function* ({ migrate, migrationLedger, migrationLedgerIs, storeUnownedNote, storedNotesAre, noAccountsAreStored }) {
		expect(yield* migrate()).toBe(0);
		const applied = yield* migrationLedger();
		yield* storeUnownedNote("Keep this note");
		expect(yield* migrate()).toBe(0);
		yield* migrationLedgerIs(applied);
		yield* storedNotesAre([{ title: "Keep this note" }]);
		yield* noAccountsAreStored;
	},
);

deployment.it(
	"refuses to serve accounts or jobs until deployment migration succeeds",
	[],
	function* ({ migrate, refusesUnmigratedSchema, startsServingAccountsAndJobs, port: availablePort, migrationLedgerIsAbsent }) {
		const port = yield* availablePort;
		yield* refusesUnmigratedSchema(port);
		yield* migrationLedgerIsAbsent;
		expect(yield* migrate()).toBe(0);
		yield* startsServingAccountsAndJobs(port);
	},
);

deployment.it(
	"fails migration without recording success when an existing table conflicts",
	[conflictingNotesTable()],
	function* ({ migrate, migrationLedgerIsAbsent }) {
		expect(yield* migrate()).not.toBe(0);
		yield* migrationLedgerIsAbsent;
	},
);
