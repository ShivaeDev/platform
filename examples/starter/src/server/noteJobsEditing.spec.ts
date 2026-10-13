import { Effect, Layer, Redacted, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect, vi } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authPost, credentials, notesHttp } from "#test-support/authHttp.ts";
import { effectApp } from "#test-support/postgres.ts";
import { noteWorker } from "./noteWorker.ts";

effectApp(
	"counts the edited title through the versioned repository and completes jobs for deleted notes",
	function* ({ baseUrl }) {
		const cookie = yield* authPost(baseUrl, "sign-up/email", credentials("alice"));
		const client = yield* notesHttp(baseUrl, cookie);
		const original = yield* client["notes.create"]({ title: "Old title" });
		const edited = yield* client["notes.update"]({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		const deleted = yield* client["notes.create"]({ title: "Deleted before counting" });
		yield* client["notes.delete"]({ id: deleted.id, version: deleted.version });
		const database = yield* PostgresTestDatabase;
		yield* Layer.build(noteWorker({ databaseUrl: database.url, secret: Redacted.make("starter-test-secret-with-at-least-32-characters") }));
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(client["notes.get"]({ id: edited.id }))).toEqual(counted);
				},
				{ timeout: 5000 },
			),
		);
		const stale = yield* client["notes.update"]({ ...edited, title: "Before counting" }).pipe(Effect.result);
		expect(Result.isFailure(stale) && stale.failure._tag).toBe("Conflict");
		expect(yield* client["notes.list"]()).toEqual([counted]);
		const sql = yield* SqlClient.SqlClient;
		yield* Effect.promise(() =>
			vi.waitFor(
				async () => {
					expect(await Effect.runPromise(sql`select state from pgboss.job where name = 'count-note-words'`)).toEqual([
						{ state: "completed" },
						{ state: "completed" },
						{ state: "completed" },
					]);
				},
				{ timeout: 5000 },
			),
		);
	},
	15_000,
);
