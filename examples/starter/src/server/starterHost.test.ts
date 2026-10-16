import { Effect, Layer, Redacted, Result } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authPost, credentials, notesHttp } from "#test-support/authHttp.ts";
import { effectApp } from "#test-support/postgres.ts";
import { starterHost } from "./starterHost.ts";

effectApp("migrates PostgreSQL and creates and queries a persisted note over authenticated HTTP/NDJSON", function* ({ baseUrl }) {
	const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const client = yield* notesHttp(baseUrl, cookie);
	expect(yield* client["notes.list"]()).toEqual([]);
	const created = yield* client["notes.create"]({ title: "  First note  " });
	expect(created.title).toBe("First note");
	expect(yield* client["notes.list"]()).toEqual([created]);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select id, title, "wordCount", version from starter_notes`).toEqual([created]);
	const invalid = yield* client["notes.create"]({ title: "   " }).pipe(Effect.result);
	expect(Result.isFailure(invalid) && invalid.failure._tag).toBe("Invalid");
	expect(yield* client["notes.list"]()).toEqual([created]);
});

effectApp("reruns the starter migration path without losing auth accounts or notes", function* ({ baseUrl }) {
	const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const client = yield* notesHttp(baseUrl, cookie);
	const note = yield* client["notes.create"]({ title: "Keep this note" });
	const database = yield* PostgresTestDatabase;
	const context = yield* Layer.build(
		starterHost({ databaseUrl: database.url, port: 0, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected TCP server");
	}
	const restartedUrl = `http://127.0.0.1:${server.address.port}`;
	const returning = yield* authPost(restartedUrl, "sign-in/email", credentials("alice"));
	const restarted = yield* notesHttp(restartedUrl, returning);
	expect(yield* restarted["notes.list"]()).toEqual([note]);
});

effectApp("adds word counts to notes saved before the job migration", function* ({ baseUrl }) {
	const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const client = yield* notesHttp(baseUrl, cookie);
	const note = yield* client["notes.create"]({ title: "Keep this old note" });
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table starter_notes drop column "wordCount"`;
	yield* sql`alter table starter_notes drop column version`;
	yield* sql`delete from starter_migrations where migration_id >= 4`;
	const database = yield* PostgresTestDatabase;
	yield* Layer.build(starterHost({ databaseUrl: database.url, port: 0, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }));
	expect(yield* client["notes.list"]()).toEqual([{ ...note, wordCount: 4 }]);
});

effectApp("upgrades existing notes with version zero and accepts their first versioned edit", function* ({ baseUrl }) {
	const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const client = yield* notesHttp(baseUrl, cookie);
	const note = yield* client["notes.create"]({ title: "Existing note" });
	const sql = yield* SqlClient.SqlClient;
	yield* sql`alter table starter_notes drop column version`;
	yield* sql`delete from starter_migrations where migration_id = 5`;
	const database = yield* PostgresTestDatabase;
	yield* Layer.build(starterHost({ databaseUrl: database.url, port: 0, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }));
	expect(yield* client["notes.get"]({ id: note.id })).toEqual({ ...note, version: 0 });
	expect(yield* client["notes.update"]({ ...note, title: "Edited old note" })).toEqual({ ...note, title: "Edited old note", version: 1 });
});

effectApp("protects queries and commands, isolates users, and revokes the signed-out session before signing in again", function* ({ baseUrl }) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`insert into starter_notes (title) values ('Legacy note')`;
	const anonymous = yield* notesHttp(baseUrl);
	for (const call of [anonymous["notes.list"]().pipe(Effect.asVoid), anonymous["notes.create"]({ title: "Anonymous note" }).pipe(Effect.asVoid)]) {
		const result = yield* Effect.result(call);
		expect(Result.isFailure(result) && result.failure._tag).toBe("Unauthorized");
	}
	const aliceCookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
	const alice = yield* notesHttp(baseUrl, aliceCookie);
	const note = yield* alice["notes.create"]({ title: "Alice's note" });
	const bobCookie = yield* authPost(baseUrl, "sign-up/email", credentials("bob"));
	const bob = yield* notesHttp(baseUrl, bobCookie);
	expect(yield* bob["notes.list"]()).toEqual([]);
	expect(yield* alice["notes.list"]()).toEqual([note]);
	const user = yield* alice["notes.whoami"]();
	expect(yield* sql`select "ownerId" from starter_notes where title = ${note.title}`).toEqual([{ ownerId: user.id }]);
	expect(yield* sql`select "ownerId" from starter_notes where title = 'Legacy note'`).toEqual([{ ownerId: null }]);
	yield* authPost(baseUrl, "sign-out", {}, aliceCookie);
	const revoked = yield* alice["notes.create"]({ title: "Revoked note" }).pipe(Effect.result);
	expect(Result.isFailure(revoked) && revoked.failure._tag).toBe("Unauthorized");
	const signedIn = yield* authPost(baseUrl, "sign-in/email", credentials("alice"));
	const returning = yield* notesHttp(baseUrl, signedIn);
	expect(yield* returning["notes.list"]()).toEqual([note]);
});
