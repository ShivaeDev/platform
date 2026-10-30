import { Effect } from "effect";
import { transact } from "@shivaedev/sql/transact.ts";
import { CountWords, NoteJobs } from "./jobs.ts";
import { makeNotesRepository } from "./makeRepository.ts";

const countWords = CountWords.handle(({ noteId }) =>
	Effect.gen(function* () {
		const repository = yield* makeNotesRepository;
		const rows = yield* repository.findMany({ where: { id: noteId, wordCount: null } });
		for (const row of rows) {
			yield* repository.update({ ...row, wordCount: row.title.split(/\s+/u).length });
		}
	}).pipe(transact({ onSqlError: (error) => error }), Effect.withSpan("CountWords", { kind: "consumer" })),
);

export const notesWorker = NoteJobs.layer({
	jobs: [countWords],
});
