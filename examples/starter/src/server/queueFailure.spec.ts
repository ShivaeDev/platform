import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { app, rejectedNoteJobs, signedIn } from "#test-support/application.ts";

app.it("saves and edits notes when PostgreSQL rejects enqueueing", [signedIn(), rejectedNoteJobs()], function* ({ actor }) {
	const { notes } = actor();
	const created = yield* notes.create({ title: "Still saved" });
	const edited = yield* notes.update({ ...created, title: "Still edited" });
	expect(yield* notes.get({ id: created.id })).toEqual(edited);
	const sql = yield* SqlClient.SqlClient;
	expect(yield* sql`select title, version, "wordCount" from starter_notes where id = ${created.id}`).toEqual([
		{ title: "Still edited", version: 1, wordCount: null },
	]);
	expect(yield* sql`select count(*)::int as count from pgboss.job`).toEqual([{ count: 0 }]);
});
