import { CountWords, NoteJobs } from "./noteJobs.ts";

export function noteProducer(connectionString: string) {
	return NoteJobs.layer({ connectionString, jobs: [CountWords] });
}
