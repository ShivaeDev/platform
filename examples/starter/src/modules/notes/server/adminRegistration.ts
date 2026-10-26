import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { jobsHandlers } from "@shivaedev/admin/server/jobsHandlers.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { Admin, JobsPage, NoteStatistics, StatisticsPage } from "#modules/notes/admin.ts";
import { NoteJobs } from "./jobs.ts";

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
				read(undefined).pipe(Effect.mapError(() => new ServiceUnavailable({ message: "Could not read note statistics" }))),
		});
	}),
);

export const adminRegistration = registerAdmin(Admin, {
	jobs: jobsHandlers(JobsPage, NoteJobs),
	"note-statistics": statistics,
	users: usersHandlers,
});
