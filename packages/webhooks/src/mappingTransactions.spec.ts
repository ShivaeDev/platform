import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { inbox, ledgerKept } from "#test/story.ts";

inbox.it(
	"a ledger entry the mapping's service writes through transact commits with the receipt and its job, and its change key is announced in the host",
	[ledgerKept],
	function* ({ announcedLedgerChanges, answer, deliver, handledJobs, storedLedgerEntries, storedReceipts }) {
		expect(yield* storedLedgerEntries()).toEqual([]);

		yield* deliver("a delivery whose mapping enters issue 42 in the ledger");

		yield* outcomes([
			["answer", () => answer(), "202 Accepted: queued"],
			["announced ledger changes", () => announcedLedgerChanges(), ["issue-ledger"]],
			["handled jobs", () => handledJobs(), ["webhook-issue for issue 42"]],
			["stored ledger entries", () => storedLedgerEntries(), [42]],
			[
				"stored receipts",
				() => storedReceipts(),
				[{ delivery: "delivery-1", event: "ledger_issues", jobs: ["webhook-issue for issue 42"], outcome: "queued", source: "github" }],
			],
		]);
	},
);

inbox.it(
	"a mapping that refuses the delivery after its service wrote a ledger entry through transact answers unavailable and rolls back the entry with the receipt",
	[ledgerKept],
	function* ({ answer, deliver, errorLogs, handledJobs, storedLedgerEntries, storedReceipts }) {
		yield* deliver("a delivery whose mapping enters issue 42 in the ledger and then refuses it");

		yield* outcomes([
			["answer", () => answer(), "503 Service Unavailable"],
			["error logs", () => errorLogs(), [expect.objectContaining({ annotations: expect.objectContaining({ errorTag: "LedgerEntryRefused" }) })]],
			["handled jobs", () => handledJobs(), []],
			["stored ledger entries", () => storedLedgerEntries(), []],
			["stored receipts", () => storedReceipts(), []],
		]);
	},
);
