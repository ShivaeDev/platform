import { app, existingContacts, oldSchema } from "#test/migrationStory.ts";

app.it("preserves existing email addresses in a new table", [existingContacts, oldSchema], function* ({ backfill, emailsArePreserved }) {
	yield* backfill();
	yield* emailsArePreserved();
});
