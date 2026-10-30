import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { hostWaitsForMigrations, jobsSchemaInstalled, legacyReceipts, schemaInbox } from "#test/schemaInbox.ts";

schemaInbox.it("the receipts component reports webhook_receipts missing until it is applied", [], function* ({ applyReceipts, pending }) {
	expect(yield* pending()).toBe("webhook_receipts is missing");

	yield* applyReceipts();

	expect(yield* pending()).toBe("nothing pending");
});

schemaInbox.it(
	"migrating existing JSON receipts preserves their fields and ordered job ids in text arrays, including after a rerun",
	[legacyReceipts],
	function* ({ applyReceipts, pending, receiptJobIdsType, receipts }) {
		expect(yield* pending()).toBe("pending receipt migrations: create_receipts, receipt_job_ids");

		yield* applyReceipts();
		yield* applyReceipts();

		yield* outcomes({
			"job ids column": [receiptJobIdsType(), [{ type: "text[]" }]],
			"pending migrations": [pending(), "nothing pending"],
			"preserved receipts": [
				receipts(),
				[
					{
						deliveryId: "delivery-1",
						event: "issues",
						jobIds: ["second-job", "first-job"],
						outcome: "queued",
						receivedAt: new Date("2026-10-01T12:00:00Z"),
						source: "github",
					},
					{
						deliveryId: "delivery-2",
						event: "ping",
						jobIds: [],
						outcome: "ignored",
						receivedAt: new Date("2026-10-01T12:00:01Z"),
						source: "github",
					},
				],
			],
		});
	},
);

schemaInbox.it(
	"a host in check mode refuses to serve receipts that still need the job ids migration",
	[jobsSchemaInstalled, legacyReceipts],
	function* ({ startInCheckMode }) {
		expect(yield* startInCheckMode()).toBe(
			"refused to start: Database migrations are not current: component webhook-receipts: pending receipt migrations: create_receipts, receipt_job_ids. Run the deployment migration command.",
		);
	},
);

schemaInbox.it(
	"a host in check mode refuses to start while the receipts component is missing and names it",
	[jobsSchemaInstalled],
	function* ({ startInCheckMode }) {
		expect(yield* startInCheckMode()).toBe(
			"refused to start: Database migrations are not current: component webhook-receipts: webhook_receipts is missing. Run the deployment migration command.",
		);
	},
);

schemaInbox.it(
	"a host in wait mode waits for the receipts component and starts once it is applied",
	[jobsSchemaInstalled, hostWaitsForMigrations],
	function* ({ applyReceipts, host, hostStart }) {
		expect(yield* host()).toBe("waiting for webhook-receipts");

		yield* applyReceipts();

		expect(yield* hostStart()).toBe("started");
	},
);
