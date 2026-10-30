import { expect } from "vitest";
import { app, existingContacts, oldSchema } from "#test/migrationStory.ts";

app.it(
	"the backfill moves every existing contact's email address into the new emails table",
	[oldSchema, existingContacts],
	function* ({ backfill, contactEmails, emailAddresses }) {
		expect(yield* contactEmails()).toEqual(["alice@example.test", "bob@example.test"]);

		yield* backfill();

		expect(yield* emailAddresses()).toEqual([
			{ address: "alice@example.test", contactId: 1 },
			{ address: "bob@example.test", contactId: 2 },
		]);
	},
);
