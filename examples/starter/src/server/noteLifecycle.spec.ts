import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { app, legacyNote, notesPredatingMigration, signedIn } from "#test-support/application.ts";

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
	"reruns the app migration path without losing auth accounts or notes",
	[signedIn()],
	function* ({ actor, rerunMigrations, authenticate, notes }) {
		const { notes: client } = actor();
		const note = yield* client.create({ title: "Keep this note" });
		yield* rerunMigrations();
		const returning = yield* authenticate("alice", "sign-in/email");
		const reopened = yield* notes(returning);
		expect(yield* reopened.list()).toEqual([note]);
	},
);

app.it(
	"adds word counts to notes saved before the job migration",
	[signedIn(), notesPredatingMigration(4, "Keep this old note")],
	function* ({ actor, rerunMigrations, existingNote }) {
		const note = existingNote("Keep this old note");
		yield* rerunMigrations();
		expect(yield* actor().notes.list()).toEqual([{ ...note, wordCount: 4 }]);
	},
);

app.it(
	"upgrades existing notes with version zero and accepts their first versioned edit",
	[signedIn(), notesPredatingMigration(5, "Existing note")],
	function* ({ actor, rerunMigrations, existingNote }) {
		const note = existingNote("Existing note");
		const { notes: client } = actor();
		yield* rerunMigrations();
		expect(yield* client.get({ id: note.id })).toEqual({ ...note, version: 0 });
		expect(yield* client.update({ ...note, title: "Edited old note" })).toEqual({ ...note, title: "Edited old note", version: 1 });
	},
);

app.it(
	"protects queries and commands, isolates users, and revokes the signed-out session before signing in again",
	[signedIn(), signedIn("bob"), legacyNote("Legacy note")],
	function* ({ actor, authenticate, notes, anonymous, storedNoteOwner }) {
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
		expect(yield* storedNoteOwner(note.title)).toEqual([{ ownerId: user.id }]);
		expect(yield* storedNoteOwner("Legacy note")).toEqual([{ ownerId: null }]);
		yield* authenticate("alice", "sign-out", aliceCookie);
		const revokedCreate = yield* alice.create({ title: "Revoked note" }).pipe(Effect.flip);
		expect(revokedCreate).toMatchObject({ _tag: "Unauthorized" });
		expect(revokedCreate).toBeInstanceOf(Unauthorized);
		const returningCookie = yield* authenticate("alice", "sign-in/email");
		const returning = yield* notes(returningCookie);
		expect(yield* returning.list()).toEqual([note]);
	},
);
