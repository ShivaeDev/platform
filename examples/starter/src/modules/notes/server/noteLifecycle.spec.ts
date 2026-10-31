import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, legacyNote, signedIn } from "#modules/notes/test-support/application.ts";

app.it("creates and queries a persisted note over authenticated HTTP/NDJSON", [signedIn()], function* ({ actor, storedNotes }) {
	const { notes: client } = actor();
	expect(yield* client.list()).toEqual([]);
	const created = yield* client.create({ title: "First note" });
	yield* outcomes([
		["created title", () => Effect.sync(() => created.title), "First note"],
		["list", () => client.list(), [created]],
		["stored notes", () => storedNotes(), [created].map((note) => expect.objectContaining(note))],
	]);
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
		yield* outcomes([
			["alice list", () => alice.list(), [note]],
			["bob list", () => bob.list(), []],
		]);
		const user = actor();
		yield* outcomes([
			["legacy note owner", () => storedNoteOwners("Legacy note"), [{ userId: null }]],
			["new note owner", () => storedNoteOwners(note.title), [{ userId: user.userId }]],
		]);
		yield* signOut(aliceCookie);
		const revokedCreate = yield* alice.create({ title: "Revoked note" }).pipe(Effect.flip);
		expect(revokedCreate).toMatchObject({ _tag: "Unauthorized" });
		expect(revokedCreate).toBeInstanceOf(Unauthorized);
		const returningCookie = yield* mintSession("alice");
		const returning = yield* notes(returningCookie);
		expect(yield* returning.list()).toEqual([note]);
	},
);
