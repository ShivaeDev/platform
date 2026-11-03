import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defaultReceiptsInstalled, schemaInbox, schemaReceiptsIn } from "#test/schemaInbox.ts";
import { delivered, inbox, receiptsInSchema } from "#test/story.ts";

for (const schema of ["webhooks", 'Webhook-"Inbox']) {
	inbox.it(
		`receipts and their ledger live in schema ${schema}, where a replay answers already queued, keeps one receipt and runs each worker once`,
		[receiptsInSchema(schema), delivered("the signed issue 42 delivery")],
		function* ({ answer, deliver, handledJobs, storedReceipts, storedReceiptTables }) {
			expect(yield* answer()).toBe("202 Accepted: queued");

			yield* deliver("the signed issue 42 delivery");

			yield* outcomes([
				["answer", () => answer(), "200 OK: already queued"],
				["handled jobs", () => handledJobs(), ["webhook-audit for issue 42", "webhook-issue for issue 42"]],
				["stored receipt tables", () => storedReceiptTables(), [`${schema}.webhook_receipts`, `${schema}.webhook_receipts_migrations`]],
				[
					"stored receipts",
					() => storedReceipts(),
					[
						{
							delivery: "delivery-1",
							event: "issues",
							jobs: ["webhook-audit for issue 42", "webhook-issue for issue 42"],
							outcome: "queued",
							source: "github",
						},
					],
				],
			]);
		},
	);
}

schemaInbox.it(
	"a custom schema stays pending despite a migrated default schema, then is current after repeated application",
	[defaultReceiptsInstalled, schemaReceiptsIn("webhooks")],
	function* ({ applyReceipts, pending }) {
		expect(yield* pending()).toBe("webhooks.webhook_receipts is missing");

		yield* applyReceipts();
		yield* applyReceipts();

		expect(yield* pending()).toBe("nothing pending");
	},
);
