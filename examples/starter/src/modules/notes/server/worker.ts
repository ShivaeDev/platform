import { Effect } from "effect";
import { jobModule } from "@shivaedev/jobs/server/jobModule.ts";
import { CountWords, NoteJobs } from "./jobs.ts";
import { NotesRepository } from "./Repository.ts";

const countWords = CountWords.handle(({ noteId }) =>
	Effect.gen(function* () {
		const repository = yield* NotesRepository;
		const rows = yield* repository.findMany({ where: { id: noteId, wordCount: null } });
		for (const row of rows) {
			yield* repository.update({ ...row, wordCount: row.title.split(/\s+/u).length });
		}
	}).pipe(Effect.withSpan("CountWords", { kind: "consumer" })),
);

export const notesWorker = jobModule(NoteJobs.layer, {
	jobs: [countWords],
});
