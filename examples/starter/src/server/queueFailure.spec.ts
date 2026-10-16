import { Effect, Result } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it("keeps note writes committed when the queue cannot accept jobs", [signedIn()], function* ({ actor }) {
	const sql = yield* SqlClient.SqlClient;
	const { notes: client } = actor();
	yield* sql`drop table pgboss.job cascade`;
	const created = yield* client.create({ title: "Saved without a queue" });
	const updated = yield* client.update({ ...created, title: "Still saved" });
	expect(updated).toEqual({ ...created, title: "Still saved", version: 1 });
	expect(yield* client.get({ id: created.id })).toEqual(updated);
	expect(yield* sql`select title, version, "wordCount" from starter_notes`).toEqual([{ title: "Still saved", version: 1, wordCount: null }]);
});

app.it("does not enqueue a note when its write transaction fails at commit", [signedIn()], function* ({ actor }) {
	const sql = yield* SqlClient.SqlClient;
	const { notes: client } = actor();
	yield* sql`create function reject_note_commit() returns trigger language plpgsql as $$
		begin raise exception 'rejected at commit'; end;
	$$`;
	yield* sql`create constraint trigger reject_note_commit after insert on starter_notes
		deferrable initially deferred for each row execute function reject_note_commit()`;
	const result = yield* client.create({ title: "Not committed" }).pipe(Effect.result);
	expect(Result.isFailure(result) && result.failure._tag).toBe("ServiceUnavailable");
	expect(yield* sql`select count(*)::int as count from starter_notes`).toEqual([{ count: 0 }]);
	expect(yield* sql`select count(*)::int as count from pgboss.job where name = 'count-note-words'`).toEqual([{ count: 0 }]);
});
