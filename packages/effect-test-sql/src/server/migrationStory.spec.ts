import { expect } from "vitest";
import { app, existingContacts, oldSchema } from "#test/migrationStory.ts";

app.it("preserves existing email addresses in a new table", [existingContacts, oldSchema], function* ({ backfill, readEmails }) {
	yield* backfill();
	expect(yield* readEmails()).toEqual([
		{ address: "alice@example.test", "contact_id": 1 },
		{ address: "bob@example.test", "contact_id": 2 },
	]);
});
