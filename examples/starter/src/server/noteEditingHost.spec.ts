import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it("opens, updates and deletes notes over HTTP, rejecting stale writes without changing the persisted row", [signedIn()], function* ({ actor }) {
	const { notes: client } = actor();
	const original = yield* client.create({ title: "Original" });
	expect(original.version).toBe(0);
	expect(yield* client.get({ id: original.id })).toEqual(original);
	const saved = yield* client.update({ ...original, title: "  Saved note  " });
	expect(saved).toEqual({ ...original, title: "Saved note", version: 1 });
	const sql = yield* SqlClient.SqlClient;
	const before = yield* sql`select * from starter_notes where id = ${original.id}`;
	for (const call of [
		client.update({ ...original, title: "Stale draft" }).pipe(Effect.asVoid),
		client.delete({ id: original.id, version: original.version }),
	]) {
		const rejected = yield* call.pipe(Effect.result);
		expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("Conflict");
		expect(yield* sql`select * from starter_notes where id = ${original.id}`).toEqual(before);
	}
	expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 2 }]);
	const invalid = yield* client.update({ ...saved, title: "   " }).pipe(Effect.result);
	expect(Result.isFailure(invalid) && invalid.failure).toMatchObject({ _tag: "Invalid", field: "title", message: "Enter a title" });
	expect(yield* client.get({ id: saved.id })).toEqual(saved);
	yield* client.delete({ id: saved.id, version: saved.version });
	expect(yield* client.list()).toEqual([]);
	for (const call of [
		client.get({ id: saved.id }).pipe(Effect.asVoid),
		client.update({ ...saved, title: "Missing" }).pipe(Effect.asVoid),
		client.delete({ id: saved.id, version: saved.version }),
	]) {
		const missing = yield* call.pipe(Effect.result);
		expect(Result.isFailure(missing) && missing.failure._tag).toBe("NotFound");
	}
});

app.it(
	"returns NotFound to another account for get, update and delete, and requires a session",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous }) {
		const { notes: alice } = actor();
		const original = yield* alice.create({ title: "Alice's note" });
		const bob = actor("bob").notes;
		const signedOut = yield* anonymous();
		for (const [client, tag] of [
			[bob, "NotFound"],
			[signedOut, "Unauthorized"],
		] as const) {
			for (const call of [
				client.get({ id: original.id }).pipe(Effect.asVoid),
				client.update({ ...original, title: "Another account" }).pipe(Effect.asVoid),
				client.delete({ id: original.id, version: original.version }),
			]) {
				const rejected = yield* call.pipe(Effect.result);
				expect(Result.isFailure(rejected) && rejected.failure._tag).toBe(tag);
			}
		}
		expect(yield* alice.get({ id: original.id })).toEqual(original);
	},
);
