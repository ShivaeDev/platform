import { expect } from "vitest";
import { hostWaitsForMigrations, jobsSchemaInstalled, schemaInbox } from "#test/schemaInbox.ts";

schemaInbox.it("the receipts component reports webhook_receipts missing until it is applied", [], function* ({ applyReceipts, pending }) {
	expect(yield* pending()).toBe("webhook_receipts is missing");

	yield* applyReceipts();

	expect(yield* pending()).toBe("nothing pending");
});

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
