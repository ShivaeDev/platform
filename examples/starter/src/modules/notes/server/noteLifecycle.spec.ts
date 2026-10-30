import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { app, legacyNote, replacementNotes, signedIn } from "#modules/notes/test-support/application.ts";

app.it("creates and queries a persisted note over authenticated HTTP/NDJSON", [signedIn()], function* ({ actor, storedNotes }) {
	const { notes: client } = actor();
	expect(yield* client.list()).toEqual([]);
	const created = yield* client.create({ title: "  First note  " });
	expect(created.title).toBe("First note");
	expect(yield* client.list()).toEqual([created]);
	expect(yield* storedNotes()).toEqual([created].map((note) => expect.objectContaining(note)));
	expect(yield* client.create({ title: "   " }).pipe(Effect.flip)).toMatchObject({ _tag: "Invalid" });
	expect(yield* client.list()).toEqual([created]);
});

app.it(
	"protects queries and commands, isolates users, and rejects a revoked minted session",
	[signedIn(), signedIn("bob"), legacyNote("Legacy note")],
	function* ({ actor, signOut, mintSession, notes, anonymous, storedNoteOwners }) {
		const signedOut = yield* anonymous();
		const anonymousList = yield* signedOut.list().pipe(Effect.flip);
		expect(anonymousList).toMatchObject({ _tag: "Unauthorized" });
		expect(anonymousList).toBeInstanceOf(Unauthorized);
		const anonymousCreate = yield* signedOut.create({ title: "Anonymous note" }).pipe(Effect.flip);
		expect(anonymousCreate).toMatchObject({ _tag: "Unauthorized" });
		expect(anonymousCreate).toBeInstanceOf(Unauthorized);
		const { cookie: aliceCookie, notes: alice } = actor();
		const note = yield* alice.create({ title: "Alice's note" });
		const bob = actor("bob").notes;
		expect(yield* bob.list()).toEqual([]);
		expect(yield* alice.list()).toEqual([note]);
		const user = yield* alice.whoami();
		expect(yield* storedNoteOwners(note.title)).toEqual([{ ownerId: user.id }]);
		expect(yield* storedNoteOwners("Legacy note")).toEqual([{ ownerId: null }]);
		yield* signOut(aliceCookie);
		const revokedCreate = yield* alice.create({ title: "Revoked note" }).pipe(Effect.flip);
		expect(revokedCreate).toMatchObject({ _tag: "Unauthorized" });
		expect(revokedCreate).toBeInstanceOf(Unauthorized);
		const returningCookie = yield* mintSession("alice");
		const returning = yield* notes(returningCookie);
		expect(yield* returning.list()).toEqual([note]);
	},
);

app.it("serves a replacement service's catalog over authenticated HTTP", [replacementNotes(), signedIn()], function* ({ actor }) {
	expect(yield* actor().notes.list()).toEqual([{ id: 42, title: "Preview from a fake port", version: 1, wordCount: 5 }]);
});
