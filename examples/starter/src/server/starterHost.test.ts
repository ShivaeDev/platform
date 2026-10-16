import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { app, legacyNote, signedIn } from "#test-support/application.ts";

app.it("migrates PostgreSQL and creates and queries a persisted note over authenticated HTTP/NDJSON", [signedIn()], function* ({ actor }) {
	const { notes: client } = actor();
	expect(yield* client.list()).toEqual([]);
	const created = yield* client.create({ title: "  First note  " });
	expect(created.title).toBe("First note");
	expect(yield* client.list()).toEqual([created]);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select id, title, "wordCount", version from starter_notes`).toEqual([created]);
	const invalid = yield* client.create({ title: "   " }).pipe(Effect.result);
	expect(Result.isFailure(invalid) && invalid.failure._tag).toBe("Invalid");
	expect(yield* client.list()).toEqual([created]);
});

app.it(
	"reruns the starter migration path without losing auth accounts or notes",
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

app.it("adds word counts to notes saved before the job migration", [signedIn()], function* ({ actor, rerunMigrations }) {
	const { notes: client } = actor();
	const note = yield* client.create({ title: "Keep this old note" });
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table starter_notes drop column "wordCount"`;
	yield* sql`alter table starter_notes drop column version`;
	yield* sql`delete from starter_migrations where migration_id >= 4`;
	yield* rerunMigrations();
	expect(yield* client.list()).toEqual([{ ...note, wordCount: 4 }]);
});

app.it("upgrades existing notes with version zero and accepts their first versioned edit", [signedIn()], function* ({ actor, rerunMigrations }) {
	const { notes: client } = actor();
	const note = yield* client.create({ title: "Existing note" });
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table starter_notes drop column version`;
	yield* sql`delete from starter_migrations where migration_id = 5`;
	yield* rerunMigrations();
	expect(yield* client.get({ id: note.id })).toEqual({ ...note, version: 0 });
	expect(yield* client.update({ ...note, title: "Edited old note" })).toEqual({ ...note, title: "Edited old note", version: 1 });
});

app.it(
	"protects queries and commands, isolates users, and revokes the signed-out session before signing in again",
	[signedIn(), signedIn("bob"), legacyNote("Legacy note")],
	function* ({ actor, authenticate, notes, anonymous }) {
		const sql = yield* SqlClient.SqlClient;
		const signedOut = yield* anonymous();
		for (const call of [signedOut.list().pipe(Effect.asVoid), signedOut.create({ title: "Anonymous note" }).pipe(Effect.asVoid)]) {
			const result = yield* Effect.result(call);
			expect(Result.isFailure(result) && result.failure._tag).toBe("Unauthorized");
		}
		const { cookie: aliceCookie, notes: alice } = actor();
		const note = yield* alice.create({ title: "Alice's note" });
		const bob = actor("bob").notes;
		expect(yield* bob.list()).toEqual([]);
		expect(yield* alice.list()).toEqual([note]);
		const users = yield* sql<{ id: string }>`select id from "user" where email = 'alice@starter.test'`;
		expect(yield* sql`select "ownerId" from starter_notes where title = ${note.title}`).toEqual([{ ownerId: users[0]?.id }]);
		expect(yield* sql`select "ownerId" from starter_notes where title = 'Legacy note'`).toEqual([{ ownerId: null }]);
		yield* authenticate("alice", "sign-out", aliceCookie);
		const revoked = yield* alice.create({ title: "Revoked note" }).pipe(Effect.result);
		expect(Result.isFailure(revoked) && revoked.failure._tag).toBe("Unauthorized");
		const returningCookie = yield* authenticate("alice", "sign-in/email");
		const returning = yield* notes(returningCookie);
		expect(yield* returning.list()).toEqual([note]);
	},
);
