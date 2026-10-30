import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { rpcBoundary } from "@shivaedev/errors/boundary.ts";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { Admin, NoteStatistics, StatisticsPage } from "#modules/notes/admin.ts";
import { notesSqlFailure } from "./sqlFailure.ts";

const statistics = StatisticsPage.contract.application.toLayer(
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		const read = SqlSchema.findOne({
			execute: () => sql`select count(*)::int as notes, count(*) filter (where word_count is null)::int as pending,
				coalesce(sum(word_count), 0)::int as words from notes`,
			Request: Schema.Void,
			Result: NoteStatistics,
		});
		return StatisticsPage.contract.application.of({
			"admin.notes.statistics": () =>
				read(undefined).pipe(
					Effect.catchTag("SqlError", (cause) => Effect.fail(notesSqlFailure(cause))),
					rpcBoundary(StatisticsPage.contract.declaration.queries[0].error, { unexpected: (message) => new InternalServerError({ message }) }),
				),
		});
	}),
);

export const adminRegistration = registerAdmin(Admin, {
	"note-statistics": statistics,
});
