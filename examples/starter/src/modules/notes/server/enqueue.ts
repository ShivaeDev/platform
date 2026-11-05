import { Effect } from "effect";
import { CountWords, NoteJobs } from "./jobs.ts";

export const enqueueNote = Effect.fn("NotesService.enqueueNote")(function* (noteId: number) {
	const jobs = yield* NoteJobs;
	yield* jobs.enqueue(CountWords, { noteId });
});
