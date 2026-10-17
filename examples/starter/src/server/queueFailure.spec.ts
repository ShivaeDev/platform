import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { app, rejectedNoteCommits, rejectedNoteJobs, signedIn } from "#test-support/application.ts";

app.it("saves and edits notes when PostgreSQL rejects enqueueing", [signedIn(), rejectedNoteJobs()], function* ({ actor }) {
	const { notes } = actor();
	const created = yield* notes.create({ title: "Still saved" });
	const edited = yield* notes.update({ ...created, title: "Still edited" });
	expect(yield* notes.get({ id: created.id })).toEqual(edited);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select title, version, "wordCount" from notes where id = ${created.id}`).toEqual([
		{ title: "Still edited", version: 1, wordCount: null },
	]);
	expect(yield* sql`select count(*)::int as count from pgboss.job`).toEqual([{ count: 0 }]);
});

app.it("does not enqueue a note when its write transaction fails at commit", [signedIn(), rejectedNoteCommits()], function* ({ actor }) {
	const result = yield* actor().notes.create({ title: "Not committed" }).pipe(Effect.result);
	expect(Result.isFailure(result) && result.failure._tag).toBe("ServiceUnavailable");
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select count(*)::int as count from notes`).toEqual([{ count: 0 }]);
	expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 0 }]);
});
