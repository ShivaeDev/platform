import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { query } from "@shivaedev/contract/operation.ts";
import { notes } from "#modules/notes/model.ts";

const Totals = Schema.Struct({ notes: Schema.Number, pending: Schema.Number, words: Schema.Number });

export const Read = query("statistics", {
	reads: () => [notes.list],
	*run() {
		const sql = yield* SqlClient.SqlClient;
		const read = SqlSchema.findOne({
			execute: () => sql`select count(*)::int as notes, count(*) filter (where word_count is null)::int as pending,
				coalesce(sum(word_count), 0)::int as words from notes`,
			Request: Schema.Void,
			Result: Totals,
		});
		// An aggregate without grouping always returns one row.
		return yield* read(undefined).pipe(Effect.catchTag("NoSuchElementError", Effect.die));
	},
});
