import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { authPost, credentials, notesHttp } from "#test-support/authHttp.ts";
import { effectApp } from "#test-support/postgres.ts";

effectApp("opens, updates and deletes notes over HTTP, rejecting stale writes without changing the persisted row", function* ({ baseUrl }) {
	const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const client = yield* notesHttp(baseUrl, cookie);
	const original = yield* client["notes.create"]({ title: "Original" });
	expect(original.version).toBe(0);
	expect(yield* client["notes.get"]({ id: original.id })).toEqual(original);
	const saved = yield* client["notes.update"]({ ...original, title: "  Saved note  " });
	expect(saved).toEqual({ ...original, title: "Saved note", version: 1 });
	const sql = yield* SqlClient.SqlClient;
	const before = yield* sql`select * from starter_notes where id = ${original.id}`;
	for (const call of [
		client["notes.update"]({ ...original, title: "Stale draft" }).pipe(Effect.asVoid),
		client["notes.delete"]({ id: original.id, version: original.version }),
	]) {
		const rejected = yield* call.pipe(Effect.result);
		expect(Result.isFailure(rejected) && rejected.failure._tag).toBe("Conflict");
		expect(yield* sql`select * from starter_notes where id = ${original.id}`).toEqual(before);
	}
	expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 2 }]);
	const invalid = yield* client["notes.update"]({ ...saved, title: "   " }).pipe(Effect.result);
	expect(Result.isFailure(invalid) && invalid.failure).toMatchObject({ _tag: "Invalid", field: "title", message: "Enter a title" });
	expect(yield* client["notes.get"]({ id: saved.id })).toEqual(saved);
	yield* client["notes.delete"]({ id: saved.id, version: saved.version });
	expect(yield* client["notes.list"]()).toEqual([]);
	for (const call of [
		client["notes.get"]({ id: saved.id }).pipe(Effect.asVoid),
		client["notes.update"]({ ...saved, title: "Missing" }).pipe(Effect.asVoid),
		client["notes.delete"]({ id: saved.id, version: saved.version }),
	]) {
		const missing = yield* call.pipe(Effect.result);
		expect(Result.isFailure(missing) && missing.failure._tag).toBe("NotFound");
	}
});

effectApp("returns NotFound to another account for get, update and delete, and requires a session", function* ({ baseUrl }) {
	const aliceCookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const alice = yield* notesHttp(baseUrl, aliceCookie);
	const original = yield* alice["notes.create"]({ title: "Alice's note" });
	const bobCookie = yield* authPost(baseUrl, "sign-up/email", credentials("bob"));
	const bob = yield* notesHttp(baseUrl, bobCookie);
	const anonymous = yield* notesHttp(baseUrl);
	for (const [client, tag] of [
		[bob, "NotFound"],
		[anonymous, "Unauthorized"],
	] as const) {
		for (const call of [
			client["notes.get"]({ id: original.id }).pipe(Effect.asVoid),
			client["notes.update"]({ ...original, title: "Another account" }).pipe(Effect.asVoid),
			client["notes.delete"]({ id: original.id, version: original.version }),
		]) {
			const rejected = yield* call.pipe(Effect.result);
			expect(Result.isFailure(rejected) && rejected.failure._tag).toBe(tag);
		}
	}
	expect(yield* alice["notes.get"]({ id: original.id })).toEqual(original);
});
