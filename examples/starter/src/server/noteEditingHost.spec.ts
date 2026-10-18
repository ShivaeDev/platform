import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"opens, edits and deletes notes while preserving saved changes after rejected writes",
	[signedIn()],
	function* ({ actor, rejectsWith, storedNotes, storedNotesAre, wordCountJobsAre }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Original" });
		expect(original.version).toBe(0);
		expect(yield* client.get({ id: original.id })).toEqual(original);
		const saved = yield* client.update({ ...original, title: "  Saved note  " });
		expect(saved).toEqual({ ...original, title: "Saved note", version: 1 });
		const before = yield* storedNotes();
		yield* client.update({ ...original, title: "Stale draft" }).pipe(rejectsWith("Conflict"));
		yield* storedNotesAre(before);
		yield* client.delete({ id: original.id, version: original.version }).pipe(rejectsWith("Conflict"));
		yield* storedNotesAre(before);
		yield* wordCountJobsAre(2);
		yield* client.update({ ...saved, title: "   " }).pipe(rejectsWith("Invalid", { field: "title", message: "Enter a title" }));
		expect(yield* client.get({ id: saved.id })).toEqual(saved);
		yield* client.delete({ id: saved.id, version: saved.version });
		expect(yield* client.list()).toEqual([]);
		yield* client.get({ id: saved.id }).pipe(rejectsWith("NotFound"));
		yield* client.update({ ...saved, title: "Missing" }).pipe(rejectsWith("NotFound"));
		yield* client.delete({ id: saved.id, version: saved.version }).pipe(rejectsWith("NotFound"));
	},
);

app.it(
	"hides another account's note and requires a session to open, edit or delete it",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous, rejectsWith }) {
		const { notes: alice } = actor();
		const original = yield* alice.create({ title: "Alice's note" });
		const bob = actor("bob").notes;
		yield* bob.get({ id: original.id }).pipe(rejectsWith("NotFound"));
		yield* bob.update({ ...original, title: "Another account" }).pipe(rejectsWith("NotFound"));
		yield* bob.delete({ id: original.id, version: original.version }).pipe(rejectsWith("NotFound"));
		const signedOut = yield* anonymous();
		yield* signedOut.get({ id: original.id }).pipe(rejectsWith("Unauthorized"));
		yield* signedOut.update({ ...original, title: "Another account" }).pipe(rejectsWith("Unauthorized"));
		yield* signedOut.delete({ id: original.id, version: original.version }).pipe(rejectsWith("Unauthorized"));
		expect(yield* alice.get({ id: original.id })).toEqual(original);
	},
);
