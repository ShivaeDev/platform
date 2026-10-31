import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { NoteStatistics } from "#modules/notes/admin/pages.ts";
import { notesSqlFailure } from "#modules/notes/server/sqlFailure.ts";

export const readStatistics = Effect.fn("Notes.readStatistics")(function* () {
	const sql = yield* SqlClient.SqlClient;
	const read = SqlSchema.findOne({
		execute: () => sql`select count(*)::int as notes, count(*) filter (where word_count is null)::int as pending,
			coalesce(sum(word_count), 0)::int as words from notes`,
		Request: Schema.Void,
		Result: NoteStatistics,
	});
	return yield* read(undefined).pipe(Effect.catchTag("SqlError", (cause) => Effect.fail(notesSqlFailure(cause))));
});
