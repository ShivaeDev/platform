import { CountWords, NoteJobs } from "#modules/notes/server/jobs.ts";

export const noteProducer = NoteJobs.layer({ jobs: [CountWords] });
