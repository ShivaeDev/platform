import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cashEntry, changeKeys, ledgerTable, ownedDraft, ownedRowsTable, watchesCashEntry, watchesOwnedDraft } from "#test/changeKeys.ts";

const OWNED_ROW_KEYS = ['record ["1","2"]', "the table"];

changeKeys.it(
	"a subscriber using decoded NumberFromString fields refreshes for the stored composite key after the repository commits an update",
	[ownedRowsTable(), ownedDraft(), watchesOwnedDraft()],
	function* ({ woken, writeOwned }) {
		expect(yield* woken()).toEqual([]);

		yield* writeOwned("update");

		expect(yield* woken()).toEqual(['record ["1","2"]']);
	},
);

changeKeys.it(
	"a subscriber using a decoded bigint beyond Number precision refreshes for the stored composite key after the repository commits an update",
	[ledgerTable(), cashEntry(), watchesCashEntry()],
	function* ({ woken, writeLedger }) {
		expect(yield* woken()).toEqual([]);

		yield* writeLedger("update");

		expect(yield* woken()).toEqual(['record ["cash","9007199254740993"]']);
	},
);

const ownedWrites = [
	{ given: [ownedRowsTable()], operation: "insertVoid" },
	{ given: [ownedRowsTable()], operation: "insertOrIgnore" },
	{ given: [ownedRowsTable(), ownedDraft()], operation: "update" },
	{ given: [ownedRowsTable(), ownedDraft()], operation: "updateVoid" },
	{ given: [ownedRowsTable(), ownedDraft()], operation: "delete" },
] as const;

for (const { given, operation } of ownedWrites) {
	changeKeys.it(
		`a composite versioned ${operation} announces the table and the row's encoded key columns only after commit`,
		given,
		function* ({ inTransaction, publishedKeys, writeOwned }) {
			yield* inTransaction(function* () {
				yield* writeOwned(operation);
				expect(yield* publishedKeys()).toEqual([]);
			});

			expect(yield* publishedKeys()).toEqual(OWNED_ROW_KEYS);
		},
	);
}

changeKeys.it(
	"a composite insertOrIgnore that a taken id ignores announces nothing",
	[ownedRowsTable(), ownedDraft()],
	function* ({ ownedRows, publishedKeys, writeOwnedInsertForTakenId }) {
		yield* writeOwnedInsertForTakenId();

		yield* outcomes([
			["owned rows", () => ownedRows(), ["1/2 Draft at version 0"]],
			["published keys", () => publishedKeys(), []],
		]);
	},
);

const ledgerWrites = [
	{ entries: ["cash 9007199254740993 holds 7"], given: [ledgerTable()], operation: "insert" },
	{ entries: ["cash 9007199254740993 holds 8"], given: [ledgerTable(), cashEntry()], operation: "update" },
	{ entries: [], given: [ledgerTable(), cashEntry()], operation: "delete" },
] as const;

for (const { entries, given, operation } of ledgerWrites) {
	changeKeys.it(
		`a ledger ${operation} announces the exact decimal key of its bigint sequence after commit`,
		given,
		function* ({ ledgerEntries, publishedKeys, writeLedger }) {
			yield* writeLedger(operation);

			yield* outcomes([
				["ledger entries", () => ledgerEntries(), [...entries]],
				["published keys", () => publishedKeys(), ['record ["cash","9007199254740993"]', "the table"]],
			]);
		},
	);
}
